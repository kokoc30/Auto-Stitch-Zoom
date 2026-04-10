import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import { UPLOAD_BASE_DIR } from '../config/upload.config.js';
import { processClips } from '../services/processing.service.js';
import type { ProcessingRequest } from '../services/processing.service.js';
import { jobStore } from '../services/jobStore.js';
import { logger } from '../utils/logger.js';
import type { ProcessingOptions } from '../types/processing.types.js';

const router = Router();

// Simple in-memory guard so the same request does not start twice.
const activeJobs = new Set<string>();

async function resolveOutputFile(jobId: string): Promise<{
  filePath: string;
  fileName: string;
  fileStat: Awaited<ReturnType<typeof fs.stat>>;
}> {
  const currentJob = jobStore.getJob(jobId);

  // Preview/download should wait until the export is fully done.
  if (currentJob) {
    if (currentJob.status === 'error') {
      const error = new Error(
        currentJob.error || 'Processing failed before the output became available.'
      );
      (error as Error & { status?: number }).status = 409;
      throw error;
    }

    if (currentJob.status !== 'done') {
      const error = new Error('Output is still processing. Please wait for completion.');
      (error as Error & { status?: number }).status = 409;
      throw error;
    }
  }

  const outputDir = path.join(UPLOAD_BASE_DIR, 'jobs', jobId, 'output');

  const outputFiles = await fs.readdir(outputDir);
  const mp4File = outputFiles.find((f) => f.endsWith('.mp4'));

  if (!mp4File) {
    const error = new Error('Output file not found for this job.');
    (error as Error & { status?: number }).status = 404;
    throw error;
  }

  const filePath = path.join(outputDir, mp4File);
  const fileStat = await fs.stat(filePath);

  if (!fileStat.isFile() || fileStat.size <= 0) {
    const error = new Error('Output file is incomplete or unavailable. Please reprocess and try again.');
    (error as Error & { status?: number }).status = 409;
    throw error;
  }

  return {
    filePath,
    fileName: mp4File,
    fileStat,
  };
}

router.post('/process', async (req, res): Promise<void> => {
  try {
    const body = req.body as Partial<ProcessingRequest>;
    const processingOptions = body.processingOptions as ProcessingOptions | undefined;

    if (!body.clipFilenames || !Array.isArray(body.clipFilenames) || body.clipFilenames.length === 0) {
      logger.warn('process', 'Rejected processing request with no clip filenames');
      res.status(400).json({
        success: false,
        error: 'No clip filenames provided. Upload clips first.',
      });
      return;
    }

    if (
      !processingOptions ||
      typeof processingOptions.zoomPercent !== 'number' ||
      processingOptions.zoomPercent < 100 ||
      processingOptions.zoomPercent > 150
    ) {
      logger.warn('process', 'Rejected processing request with invalid zoom', {
        processingOptions,
      });
      res.status(400).json({
        success: false,
        error: 'Invalid zoom percentage. Must be between 100 and 150.',
      });
      return;
    }

    if (
      !processingOptions?.outputResolution ||
      typeof processingOptions.outputResolution.width !== 'number' ||
      typeof processingOptions.outputResolution.height !== 'number' ||
      !Number.isFinite(processingOptions.outputResolution.width) ||
      !Number.isFinite(processingOptions.outputResolution.height) ||
      processingOptions.outputResolution.width <= 0 ||
      processingOptions.outputResolution.height <= 0
    ) {
      logger.warn('process', 'Rejected processing request with unresolved output resolution', {
        processingOptions,
      });
      res.status(400).json({
        success: false,
        error: 'Output resolution is not resolved yet. Re-upload clips or wait for clip metadata before starting.',
      });
      return;
    }

    if (processingOptions.transitionSettings !== undefined) {
      const ts = processingOptions.transitionSettings;
      if (
        typeof ts.enabled !== 'boolean' ||
        typeof ts.durationSec !== 'number' ||
        !Number.isFinite(ts.durationSec) ||
        ts.durationSec < 0.05 ||
        ts.durationSec > 2.0
      ) {
        logger.warn('process', 'Rejected processing request with invalid transition settings', {
          transitionSettings: ts,
        });
        res.status(400).json({
          success: false,
          error: 'Invalid transition settings. Duration must be between 0.05 and 2.0 seconds.',
        });
        return;
      }
    }

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

    const jobId = uuidv4();

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

    res.json({
      success: true,
      jobId,
    });

    processClips(jobId, {
      clipFilenames: body.clipFilenames,
      processingOptions,
    })
      .then((result) => {
        jobStore.updateJob(jobId, {
          status: 'done',
          currentStep: 'Processing complete!',
          progress: 100,
        });
        activeJobs.delete(jobKey);
        logger.info('process', 'Processing job finished', {
          jobId,
          accelerationMode: result.accelerationMode,
          concatMode: result.concatMode,
          outputFilename: result.outputFilename,
        });
      })
      .catch((err: Error) => {
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
  } catch (err: unknown) {
    const error = err as Error;
    logger.error('process', 'Unexpected error while starting processing', {
      error,
    });
    res.status(500).json({
      success: false,
      error: 'Unexpected server error while starting processing.',
    });
  }
});

router.get('/job/:jobId/status', (req, res): void => {
  const { jobId } = req.params;

  if (!jobId) {
    logger.warn('process', 'SSE status request missing job ID');
    res.status(400).json({ error: 'Missing job ID' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Helps SSE stay live behind nginx.
  res.flushHeaders();
  res.write(': connected\n\n');

  const keepAliveTimer = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': keepalive\n\n');
    }
  }, 15000);

  const currentStatus = jobStore.getJob(jobId);
  if (currentStatus) {
    res.write(`data: ${JSON.stringify(currentStatus)}\n\n`);

    if (currentStatus.status === 'done' || currentStatus.status === 'error') {
      const closeTimer = setTimeout(() => {
        clearInterval(keepAliveTimer);
        res.end();
      }, 250);

      req.on('close', () => {
        clearInterval(keepAliveTimer);
        clearTimeout(closeTimer);
      });
      return;
    }
  }

  const unsubscribe = jobStore.subscribe(jobId, (status) => {
    res.write(`data: ${JSON.stringify(status)}\n\n`);

    if (status.status === 'done' || status.status === 'error') {
      // Give the browser a moment to receive the last event.
      setTimeout(() => {
        clearInterval(keepAliveTimer);
        res.end();
      }, 500);
    }
  });

  req.on('close', () => {
    clearInterval(keepAliveTimer);
    unsubscribe();
  });
});

router.get('/preview/:jobId', async (req, res): Promise<void> => {
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
    } catch (resolveErr) {
      const error = resolveErr as Error & { status?: number };
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

      if (
        Number.isNaN(requestedStart) ||
        Number.isNaN(requestedEnd) ||
        requestedStart < 0 ||
        requestedEnd < requestedStart ||
        requestedStart >= fileSize
      ) {
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
      } else if (!res.writableEnded) {
        res.destroy(streamErr as Error);
      }
    });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error('preview', 'Unexpected preview route error', {
      error,
    });
    res.status(500).json({ success: false, error: 'Preview failed unexpectedly.' });
  }
});

router.get('/download/:jobId', async (req, res): Promise<void> => {
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
    } catch (resolveErr) {
      const error = resolveErr as Error & { status?: number };
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
      } else if (!res.writableEnded) {
        res.destroy(streamErr as Error);
      }
    });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error('download', 'Unexpected download route error', {
      error,
    });
    res.status(500).json({ success: false, error: 'Download failed unexpectedly.' });
  }
});

export default router;
