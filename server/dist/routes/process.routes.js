import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import { UPLOAD_BASE_DIR } from '../config/upload.config.js';
import { processClips } from '../services/processing.service.js';
import { jobStore } from '../services/jobStore.js';
import { logger } from '../utils/logger.js';
const router = Router();
// Track active jobs to prevent duplicate processing
const activeJobs = new Set();
async function resolveOutputFile(jobId) {
    const currentJob = jobStore.getJob(jobId);
    if (currentJob) {
        if (currentJob.status === 'error') {
            const error = new Error(currentJob.error || 'Processing failed before the output became available.');
            error.status = 409;
            throw error;
        }
        if (currentJob.status !== 'done') {
            const error = new Error('Output is still processing. Please wait for completion.');
            error.status = 409;
            throw error;
        }
    }
    const outputDir = path.join(UPLOAD_BASE_DIR, 'jobs', jobId, 'output');
    const outputFiles = await fs.readdir(outputDir);
    const mp4File = outputFiles.find((f) => f.endsWith('.mp4'));
    if (!mp4File) {
        const error = new Error('Output file not found for this job.');
        error.status = 404;
        throw error;
    }
    const filePath = path.join(outputDir, mp4File);
    const fileStat = await fs.stat(filePath);
    if (!fileStat.isFile() || fileStat.size <= 0) {
        const error = new Error('Output file is incomplete or unavailable. Please reprocess and try again.');
        error.status = 409;
        throw error;
    }
    return {
        filePath,
        fileName: mp4File,
        fileStat,
    };
}
/**
 * POST /api/process
 * Starts the video processing pipeline asynchronously.
 * Returns the jobId immediately so the client can subscribe to SSE updates.
 */
router.post('/process', async (req, res) => {
    try {
        const body = req.body;
        const processingOptions = body.processingOptions;
        // --- Validate request ---
        if (!body.clipFilenames || !Array.isArray(body.clipFilenames) || body.clipFilenames.length === 0) {
            logger.warn('process', 'Rejected processing request with no clip filenames');
            res.status(400).json({
                success: false,
                error: 'No clip filenames provided. Upload clips first.',
            });
            return;
        }
        if (!processingOptions ||
            typeof processingOptions.zoomPercent !== 'number' ||
            processingOptions.zoomPercent < 100 ||
            processingOptions.zoomPercent > 150) {
            logger.warn('process', 'Rejected processing request with invalid zoom', {
                processingOptions,
            });
            res.status(400).json({
                success: false,
                error: 'Invalid zoom percentage. Must be between 100 and 150.',
            });
            return;
        }
        if (!processingOptions?.outputResolution ||
            typeof processingOptions.outputResolution.width !== 'number' ||
            typeof processingOptions.outputResolution.height !== 'number' ||
            !Number.isFinite(processingOptions.outputResolution.width) ||
            !Number.isFinite(processingOptions.outputResolution.height) ||
            processingOptions.outputResolution.width <= 0 ||
            processingOptions.outputResolution.height <= 0) {
            logger.warn('process', 'Rejected processing request with unresolved output resolution', {
                processingOptions,
            });
            res.status(400).json({
                success: false,
                error: 'Output resolution is not resolved yet. Re-upload clips or wait for clip metadata before starting.',
            });
            return;
        }
        // Simple guard against duplicate concurrent jobs
        const jobKey = JSON.stringify({
            clipFilenames: body.clipFilenames,
            processingOptions,
        });
        if (activeJobs.has(jobKey)) {
            logger.warn('process', 'Rejected duplicate active processing request', {
                clipCount: body.clipFilenames.length,
                zoomPercent: processingOptions.zoomPercent,
            });
            res.status(409).json({
                success: false,
                error: 'A processing job with these clips is already running. Please wait.',
            });
            return;
        }
        activeJobs.add(jobKey);
        // Generate jobId upfront so client can immediately subscribe to SSE
        const jobId = uuidv4();
        // Initialize job in the store
        jobStore.updateJob(jobId, {
            status: 'validating',
            currentStep: 'Starting...',
            totalClips: body.clipFilenames.length,
            progress: 0,
        });
        logger.info('process', 'Processing job accepted', {
            jobId,
            clipCount: body.clipFilenames.length,
            processingOptions,
        });
        // Return jobId immediately — processing happens async
        res.json({
            success: true,
            jobId,
        });
        // Run processing asynchronously
        processClips(jobId, {
            clipFilenames: body.clipFilenames,
            processingOptions,
        })
            .then((result) => {
            // Update the job store with the output URL
            jobStore.updateJob(jobId, {
                status: 'done',
                currentStep: 'Processing complete!',
                progress: 100,
            });
            activeJobs.delete(jobKey);
            logger.info('process', 'Processing job finished', {
                jobId,
                outputFilename: result.outputFilename,
            });
        })
            .catch((err) => {
            jobStore.updateJob(jobId, {
                status: 'error',
                currentStep: 'Processing failed',
                error: err.message || 'Video processing failed unexpectedly.',
            });
            activeJobs.delete(jobKey);
            logger.error('process', 'Processing job failed', {
                jobId,
                error: err,
            });
        });
    }
    catch (err) {
        const error = err;
        logger.error('process', 'Unexpected error while starting processing', {
            error,
        });
        res.status(500).json({
            success: false,
            error: 'Unexpected server error while starting processing.',
        });
    }
});
/**
 * GET /api/job/:jobId/status
 * Server-Sent Events endpoint for real-time job progress updates.
 */
router.get('/job/:jobId/status', (req, res) => {
    const { jobId } = req.params;
    if (!jobId) {
        logger.warn('process', 'SSE status request missing job ID');
        res.status(400).json({ error: 'Missing job ID' });
        return;
    }
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();
    // Send current status immediately if job already exists
    const currentStatus = jobStore.getJob(jobId);
    if (currentStatus) {
        res.write(`data: ${JSON.stringify(currentStatus)}\n\n`);
    }
    // Subscribe to future updates
    const unsubscribe = jobStore.subscribe(jobId, (status) => {
        res.write(`data: ${JSON.stringify(status)}\n\n`);
        // Close connection when job reaches terminal state
        if (status.status === 'done' || status.status === 'error') {
            // Small delay to ensure the client receives the final event
            setTimeout(() => {
                res.end();
            }, 500);
        }
    });
    // Clean up on client disconnect
    req.on('close', () => {
        unsubscribe();
    });
});
/**
 * GET /api/preview/:jobId
 * Streams the final processed video inline for browser preview playback.
 */
router.get('/preview/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        if (!jobId || typeof jobId !== 'string') {
            logger.warn('preview', 'Rejected preview request with invalid job ID');
            res.status(400).json({ success: false, error: 'Invalid job ID.' });
            return;
        }
        let resolvedOutput;
        try {
            resolvedOutput = await resolveOutputFile(jobId);
        }
        catch (resolveErr) {
            const error = resolveErr;
            logger.warn('preview', 'Preview requested but output file is unavailable', {
                jobId,
                error: error.message,
            });
            res.status(error.status ?? 404).json({ success: false, error: error.message });
            return;
        }
        const { filePath, fileName, fileStat } = resolvedOutput;
        const fileSize = Number(fileStat.size);
        const rangeHeader = req.headers.range;
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Last-Modified', fileStat.mtime.toUTCString());
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
        let start = 0;
        let end = fileSize - 1;
        let statusCode = 200;
        if (rangeHeader) {
            const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
            const requestedStart = match?.[1] ? Number.parseInt(match[1], 10) : 0;
            const requestedEnd = match?.[2] ? Number.parseInt(match[2], 10) : fileSize - 1;
            if (Number.isNaN(requestedStart) ||
                Number.isNaN(requestedEnd) ||
                requestedStart < 0 ||
                requestedEnd < requestedStart ||
                requestedStart >= fileSize) {
                res.status(416);
                res.setHeader('Content-Range', `bytes */${fileSize}`);
                res.end();
                return;
            }
            start = requestedStart;
            end = Math.min(requestedEnd, fileSize - 1);
            statusCode = 206;
            res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        }
        res.status(statusCode);
        res.setHeader('Content-Length', String(end - start + 1));
        const stream = createReadStream(filePath, { start, end });
        req.on('close', () => {
            stream.destroy();
        });
        stream.pipe(res);
        stream.on('error', (streamErr) => {
            logger.error('preview', 'Preview stream error', {
                jobId,
                filePath,
                error: streamErr,
            });
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: 'Error streaming preview.' });
            }
            else if (!res.writableEnded) {
                res.destroy(streamErr);
            }
        });
    }
    catch (err) {
        const error = err;
        logger.error('preview', 'Unexpected preview route error', {
            error,
        });
        res.status(500).json({ success: false, error: 'Preview failed unexpectedly.' });
    }
});
/**
 * GET /api/download/:jobId
 * Downloads the final processed video file.
 */
router.get('/download/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        if (!jobId || typeof jobId !== 'string') {
            logger.warn('download', 'Rejected download request with invalid job ID');
            res.status(400).json({ success: false, error: 'Invalid job ID.' });
            return;
        }
        let resolvedOutput;
        try {
            resolvedOutput = await resolveOutputFile(jobId);
        }
        catch (resolveErr) {
            const error = resolveErr;
            logger.warn('download', 'Download requested but output file is unavailable', {
                jobId,
                error: error.message,
            });
            res.status(error.status ?? 404).json({ success: false, error: error.message });
            return;
        }
        const { filePath, fileStat } = resolvedOutput;
        const fileSize = Number(fileStat.size);
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="final-output.mp4"`);
        res.setHeader('Content-Length', String(fileSize));
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Last-Modified', fileStat.mtime.toUTCString());
        const stream = createReadStream(filePath);
        req.on('close', () => {
            stream.destroy();
        });
        stream.pipe(res);
        stream.on('error', (streamErr) => {
            logger.error('download', 'Download stream error', {
                jobId,
                filePath,
                error: streamErr,
            });
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: 'Error streaming file.' });
            }
            else if (!res.writableEnded) {
                res.destroy(streamErr);
            }
        });
    }
    catch (err) {
        const error = err;
        logger.error('download', 'Unexpected download route error', {
            error,
        });
        res.status(500).json({ success: false, error: 'Download failed unexpectedly.' });
    }
});
export default router;
//# sourceMappingURL=process.routes.js.map