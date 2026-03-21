import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { FFMPEG_BIN } from '../config/media-tools.config.js';
import { logger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);

export async function normalizeAndZoomClip(
  inputPath: string,
  outputPath: string,
  outputWidth: number,
  outputHeight: number,
  zoomFactor: number,
  outputFrameRate: number,
  hasAudio: boolean
): Promise<void> {
  // Keep the zoomed canvas even so x264 stays happy.
  const scaledW = Math.ceil(outputWidth * zoomFactor / 2) * 2;
  const scaledH = Math.ceil(outputHeight * zoomFactor / 2) * 2;

  // Scale up first, then crop back to the final frame.
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
  } catch (err: unknown) {
    const error = err as Error & { stderr?: string };
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

export async function concatenateClips(
  clipPaths: string[],
  outputPath: string,
  concatListPath: string
): Promise<void> {
  // Write the list file for FFmpeg's concat demuxer.
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
  } catch (err: unknown) {
    const error = err as Error & { stderr?: string };
    logger.error('ffmpeg', 'Final export failed', {
      binary: FFMPEG_BIN,
      outputFile: path.basename(outputPath),
      stderr: error.stderr,
      error,
    });
    throw new Error('Unable to merge clips into the final export. Please try again.');
  }
}
