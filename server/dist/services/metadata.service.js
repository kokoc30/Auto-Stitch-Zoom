import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { FFPROBE_BIN } from '../config/media-tools.config.js';
import { logger } from '../utils/logger.js';
const execFileAsync = promisify(execFile);
function parseFrameRate(rate) {
    if (!rate || rate === '0/0')
        return undefined;
    if (rate.includes('/')) {
        const [numeratorRaw, denominatorRaw] = rate.split('/');
        const numerator = Number.parseFloat(numeratorRaw || '');
        const denominator = Number.parseFloat(denominatorRaw || '');
        if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
            return undefined;
        }
        return numerator / denominator;
    }
    const parsed = Number.parseFloat(rate);
    return Number.isFinite(parsed) ? parsed : undefined;
}
/**
 * Extracts video metadata using ffprobe.
 * Returns a typed inspection error when the server cannot inspect the file.
 */
export async function extractMetadata(filePath) {
    try {
        const { stdout } = await execFileAsync(FFPROBE_BIN, [
            '-v',
            'quiet',
            '-print_format',
            'json',
            '-show_streams',
            '-show_format',
            filePath,
        ]);
        const probe = JSON.parse(stdout);
        const videoStream = probe.streams?.find((stream) => stream.codec_type === 'video');
        const audioStream = probe.streams?.find((stream) => stream.codec_type === 'audio');
        const duration = probe.format?.duration
            ? parseFloat(probe.format.duration)
            : videoStream?.duration
                ? parseFloat(videoStream.duration)
                : undefined;
        const frameRate = parseFrameRate(videoStream?.avg_frame_rate) ?? parseFrameRate(videoStream?.r_frame_rate);
        return {
            duration: duration !== undefined && !Number.isNaN(duration) ? Math.round(duration * 100) / 100 : undefined,
            width: videoStream?.width,
            height: videoStream?.height,
            codec: videoStream?.codec_name,
            hasAudio: Boolean(audioStream),
            frameRate: frameRate !== undefined && frameRate >= 1
                ? Math.round(frameRate * 1000) / 1000
                : undefined,
        };
    }
    catch (error) {
        const err = error;
        if (err.code === 'ENOENT') {
            logger.warn('metadata', 'ffprobe is unavailable', {
                binary: FFPROBE_BIN,
                file: path.basename(filePath),
                error: err,
            });
            return { inspectionError: 'ffprobe-unavailable' };
        }
        logger.warn('metadata', 'ffprobe could not read media metadata', {
            binary: FFPROBE_BIN,
            file: path.basename(filePath),
            error: err,
        });
        return { inspectionError: 'invalid-media' };
    }
}
//# sourceMappingURL=metadata.service.js.map