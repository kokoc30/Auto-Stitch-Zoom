import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { FFMPEG_BIN } from '../config/media-tools.config.js';
import { logger } from '../utils/logger.js';
const execFileAsync = promisify(execFile);
/**
 * Normalizes a single clip: scales up by zoom factor, then center-crops
 * to the target output frame size. Encodes as H.264/AAC intermediate.
 *
 * @param inputPath  - Absolute path to the source clip
 * @param outputPath - Absolute path for the normalized intermediate output
 * @param outputWidth  - Target output frame width (e.g. 1080)
 * @param outputHeight - Target output frame height (e.g. 1920)
 * @param zoomFactor   - Zoom multiplier (e.g. 1.09 for 109%)
 */
export async function normalizeAndZoomClip(inputPath, outputPath, outputWidth, outputHeight, zoomFactor, outputFrameRate, hasAudio) {
    // Calculate the zoomed target canvas. We scale each clip uniformly until it fully
    // covers this zoomed canvas, then center-crop back to the final output frame.
    // Using even dimensions keeps the H.264 encode valid.
    const scaledW = Math.ceil(outputWidth * zoomFactor / 2) * 2;
    const scaledH = Math.ceil(outputHeight * zoomFactor / 2) * 2;
    // Filter chain:
    // 1. Uniformly scale input up until it covers the zoomed target canvas
    // 2. Center-crop to exact output size so zoom stays visually stable
    // 3. Set pixel format to yuv420p for compatibility
    // 4. Normalize to the chosen output frame rate for consistent concat/export
    const filterComplex = [
        `scale=${scaledW}:${scaledH}:force_original_aspect_ratio=increase`,
        `crop=${outputWidth}:${outputHeight}:(in_w-out_w)/2:(in_h-out_h)/2`,
        `setsar=1:1`,
        `fps=${outputFrameRate}`,
        `format=yuv420p`,
    ].join(',');
    const args = hasAudio
        ? [
            '-y',
            '-i', inputPath,
            '-vf', filterComplex,
            '-map', '0:v:0',
            '-map', '0:a:0',
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '18',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-ar', '48000',
            '-ac', '2',
            '-movflags', '+faststart',
            '-shortest',
            outputPath,
        ]
        : [
            '-y',
            '-i', inputPath,
            '-f', 'lavfi',
            '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
            '-vf', filterComplex,
            '-map', '0:v:0',
            '-map', '1:a:0',
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '18',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-ar', '48000',
            '-ac', '2',
            '-movflags', '+faststart',
            '-shortest',
            outputPath,
        ];
    logger.info('ffmpeg', 'Normalizing clip', {
        inputFile: path.basename(inputPath),
        outputFile: path.basename(outputPath),
        outputWidth,
        outputHeight,
        zoomFactor,
        scaledWidth: scaledW,
        scaledHeight: scaledH,
        outputFrameRate,
        hasAudio,
    });
    try {
        const { stderr } = await execFileAsync(FFMPEG_BIN, args);
        if (stderr) {
            logger.info('ffmpeg', 'Clip normalization completed', {
                outputFile: path.basename(outputPath),
            });
        }
    }
    catch (err) {
        const error = err;
        logger.error('ffmpeg', 'Clip normalization failed', {
            binary: FFMPEG_BIN,
            inputFile: path.basename(inputPath),
            outputFile: path.basename(outputPath),
            stderr: error.stderr,
            error,
        });
        throw new Error(`Unable to process clip "${path.basename(inputPath)}". Check the file and try again.`);
    }
}
/**
 * Concatenates multiple normalized clips into one final output using
 * the FFmpeg concat demuxer and a final compatibility-focused encode.
 *
 * All input clips MUST have matching stream structure, frame size, and frame rate
 * (which is intended to be guaranteed after normalizeAndZoomClip).
 *
 * @param clipPaths  - Ordered list of intermediate clip paths
 * @param outputPath - Absolute path for the final merged output
 * @param concatListPath - Path to write the temporary concat list file
 */
export async function concatenateClips(clipPaths, outputPath, concatListPath) {
    // Build the concat demuxer input file
    const listContent = clipPaths
        .map((p) => `file '${p.replace(/\\/g, '/')}'`)
        .join('\n');
    await fs.writeFile(concatListPath, listContent, 'utf-8');
    logger.info('ffmpeg', 'Concatenating normalized clips', {
        clipCount: clipPaths.length,
        outputFile: path.basename(outputPath),
    });
    const args = [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', concatListPath,
        '-map', '0:v:0',
        '-map', '0:a?',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '18',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ar', '48000',
        '-ac', '2',
        '-movflags', '+faststart',
        outputPath,
    ];
    try {
        const { stderr } = await execFileAsync(FFMPEG_BIN, args);
        if (stderr) {
            logger.info('ffmpeg', 'Final export completed', {
                outputFile: path.basename(outputPath),
            });
        }
    }
    catch (err) {
        const error = err;
        logger.error('ffmpeg', 'Final export failed', {
            binary: FFMPEG_BIN,
            outputFile: path.basename(outputPath),
            stderr: error.stderr,
            error,
        });
        throw new Error('Unable to merge clips into the final export. Please try again.');
    }
}
//# sourceMappingURL=ffmpeg.service.js.map