import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { FFMPEG_BIN, FFPROBE_BIN } from '../config/media-tools.config.js';
import { UPLOAD_BASE_DIR } from '../config/upload.config.js';
import { logger } from '../utils/logger.js';
const execFileAsync = promisify(execFile);
const STALE_ARTIFACT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
async function ensureDirectory(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}
async function checkBinaryAvailable(binaryName, command) {
    try {
        await execFileAsync(command, ['-version']);
        return true;
    }
    catch (error) {
        const err = error;
        if (err.code !== 'ENOENT') {
            logger.warn('server', 'Could not verify external media tool', {
                binaryName,
                command,
                error: err,
            });
        }
        return false;
    }
}
async function pruneStaleEntries(dirPath, olderThanMs) {
    const cutoff = Date.now() - olderThanMs;
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    let removedCount = 0;
    for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        const stat = await fs.stat(entryPath);
        if (stat.mtimeMs >= cutoff) {
            continue;
        }
        await fs.rm(entryPath, { recursive: entry.isDirectory(), force: true });
        removedCount += 1;
    }
    return removedCount;
}
export async function runStartupPreflight() {
    const incomingDir = path.join(UPLOAD_BASE_DIR, 'incoming');
    const thumbnailsDir = path.join(UPLOAD_BASE_DIR, 'thumbnails');
    const jobsDir = path.join(UPLOAD_BASE_DIR, 'jobs');
    await Promise.all([
        ensureDirectory(UPLOAD_BASE_DIR),
        ensureDirectory(incomingDir),
        ensureDirectory(thumbnailsDir),
        ensureDirectory(jobsDir),
    ]);
    const [ffmpegAvailable, ffprobeAvailable, removedIncoming, removedThumbnails, removedJobs] = await Promise.all([
        checkBinaryAvailable('ffmpeg', FFMPEG_BIN),
        checkBinaryAvailable('ffprobe', FFPROBE_BIN),
        pruneStaleEntries(incomingDir, STALE_ARTIFACT_MAX_AGE_MS),
        pruneStaleEntries(thumbnailsDir, STALE_ARTIFACT_MAX_AGE_MS),
        pruneStaleEntries(jobsDir, STALE_ARTIFACT_MAX_AGE_MS),
    ]);
    if (!ffmpegAvailable || !ffprobeAvailable) {
        logger.warn('server', 'Missing FFmpeg tooling. Upload inspection and video processing require ffmpeg and ffprobe to be installed on PATH, or configured via FFMPEG_BIN and FFPROBE_BIN.', {
            ffmpegAvailable,
            ffprobeAvailable,
            ffmpegCommand: FFMPEG_BIN,
            ffprobeCommand: FFPROBE_BIN,
        });
    }
    logger.info('server', 'Startup preflight complete', {
        ffmpegAvailable,
        ffprobeAvailable,
        ffmpegCommand: FFMPEG_BIN,
        ffprobeCommand: FFPROBE_BIN,
        removedIncoming,
        removedThumbnails,
        removedJobs,
    });
}
//# sourceMappingURL=runtime.service.js.map