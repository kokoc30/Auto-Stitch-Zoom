import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { FFMPEG_BIN } from '../config/media-tools.config.js';
import {
  NVIDIA_GPU_CQ,
  NVIDIA_GPU_HWACCEL,
  NVIDIA_GPU_PRESET,
  NVIDIA_GPU_TUNE,
  NVIDIA_GPU_VIDEO_ENCODER,
  type ProcessingAcceleration,
} from './video-acceleration.service.js';
import { logger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);
const COMMAND_MAX_BUFFER = 8 * 1024 * 1024;
const OUTPUT_VIDEO_TRACK_TIMESCALE = '90000';
const OUTPUT_AUDIO_ARGS = [
  '-c:a', 'aac',
  '-b:a', '192k',
  '-ar', '48000',
  '-ac', '2',
] as const;

export type NormalizationOptions = {
  inputPath: string;
  outputPath: string;
  outputWidth: number;
  outputHeight: number;
  zoomFactor: number;
  outputFrameRate: number;
  hasAudio: boolean;
  acceleration: ProcessingAcceleration;
};

export type NormalizationResult = {
  acceleration: ProcessingAcceleration;
  videoEncoder: string;
};

export type ConcatenationOptions = {
  clipPaths: string[];
  outputPath: string;
  concatListPath: string;
  acceleration: ProcessingAcceleration;
};

export type ConcatenationResult = {
  mode: 'copy' | 'reencode' | 'xfade';
  videoEncoder: 'copy' | 'libx264' | typeof NVIDIA_GPU_VIDEO_ENCODER;
};

export type TransitionMergeOptions = {
  clipPaths: string[];
  clipDurations: number[];
  transitionDurationSec: number;
  outputPath: string;
  acceleration: ProcessingAcceleration;
};

export type TransitionMergeResult = {
  videoEncoder: 'libx264' | typeof NVIDIA_GPU_VIDEO_ENCODER;
};

function getScaledDimensions(
  outputWidth: number,
  outputHeight: number,
  zoomFactor: number
): { scaledWidth: number; scaledHeight: number } {
  return {
    scaledWidth: Math.ceil((outputWidth * zoomFactor) / 2) * 2,
    scaledHeight: Math.ceil((outputHeight * zoomFactor) / 2) * 2,
  };
}

function buildCpuNormalizeFilter(
  outputWidth: number,
  outputHeight: number,
  zoomFactor: number,
  outputFrameRate: number
): string {
  const { scaledWidth, scaledHeight } = getScaledDimensions(outputWidth, outputHeight, zoomFactor);

  return [
    `scale=${scaledWidth}:${scaledHeight}:force_original_aspect_ratio=increase`,
    `crop=${outputWidth}:${outputHeight}:(in_w-out_w)/2:(in_h-out_h)/2`,
    'setsar=1:1',
    `fps=${outputFrameRate}`,
    'format=yuv420p',
  ].join(',');
}

function buildGpuNormalizeFilter(
  outputWidth: number,
  outputHeight: number,
  zoomFactor: number,
  outputFrameRate: number
): string {
  const { scaledWidth, scaledHeight } = getScaledDimensions(outputWidth, outputHeight, zoomFactor);

  return [
    `scale_cuda=${scaledWidth}:${scaledHeight}:format=nv12:force_original_aspect_ratio=increase:force_divisible_by=2`,
    'hwdownload',
    'format=nv12',
    `crop=${outputWidth}:${outputHeight}:(in_w-out_w)/2:(in_h-out_h)/2`,
    'setsar=1:1',
    `fps=${outputFrameRate}`,
    'format=yuv420p',
  ].join(',');
}

function buildVideoEncoderArgs(
  acceleration: ProcessingAcceleration
): Array<string> {
  if (acceleration === 'gpu') {
    return [
      '-c:v', NVIDIA_GPU_VIDEO_ENCODER,
      '-preset', NVIDIA_GPU_PRESET,
      '-tune', NVIDIA_GPU_TUNE,
      '-rc', 'vbr',
      '-cq', String(NVIDIA_GPU_CQ),
      '-b:v', '0',
      '-pix_fmt', 'yuv420p',
    ];
  }

  return [
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
  ];
}

function buildNormalizeArgs(options: NormalizationOptions): string[] {
  const {
    inputPath,
    outputPath,
    outputWidth,
    outputHeight,
    zoomFactor,
    outputFrameRate,
    hasAudio,
    acceleration,
  } = options;

  const videoFilter =
    acceleration === 'gpu'
      ? buildGpuNormalizeFilter(outputWidth, outputHeight, zoomFactor, outputFrameRate)
      : buildCpuNormalizeFilter(outputWidth, outputHeight, zoomFactor, outputFrameRate);

  const inputArgs =
    acceleration === 'gpu'
      ? ['-hwaccel', NVIDIA_GPU_HWACCEL, '-hwaccel_output_format', NVIDIA_GPU_HWACCEL, '-i', inputPath]
      : ['-i', inputPath];

  const audioInputArgs = hasAudio
    ? []
    : ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000'];

  const mapArgs = hasAudio
    ? ['-map', '0:v:0', '-map', '0:a:0']
    : ['-map', '0:v:0', '-map', '1:a:0'];

  return [
    '-y',
    ...inputArgs,
    ...audioInputArgs,
    '-vf', videoFilter,
    ...mapArgs,
    ...buildVideoEncoderArgs(acceleration),
    ...OUTPUT_AUDIO_ARGS,
    '-movflags', '+faststart',
    '-video_track_timescale', OUTPUT_VIDEO_TRACK_TIMESCALE,
    '-shortest',
    outputPath,
  ];
}

async function runFfmpegCommand(args: string[]): Promise<void> {
  await execFileAsync(FFMPEG_BIN, args, {
    maxBuffer: COMMAND_MAX_BUFFER,
  });
}

export async function normalizeAndZoomClip(
  options: NormalizationOptions
): Promise<NormalizationResult> {
  const {
    inputPath,
    outputPath,
    outputWidth,
    outputHeight,
    zoomFactor,
    outputFrameRate,
    hasAudio,
    acceleration,
  } = options;
  const { scaledWidth, scaledHeight } = getScaledDimensions(outputWidth, outputHeight, zoomFactor);
  const args = buildNormalizeArgs(options);

  logger.info('ffmpeg', 'Normalizing clip', {
    acceleration,
    inputFile: path.basename(inputPath),
    outputFile: path.basename(outputPath),
    outputWidth,
    outputHeight,
    zoomFactor,
    scaledWidth,
    scaledHeight,
    outputFrameRate,
    hasAudio,
  });

  try {
    await runFfmpegCommand(args);
    logger.info('ffmpeg', 'Clip normalization completed', {
      acceleration,
      outputFile: path.basename(outputPath),
    });

    return {
      acceleration,
      videoEncoder: acceleration === 'gpu' ? NVIDIA_GPU_VIDEO_ENCODER : 'libx264',
    };
  } catch (err: unknown) {
    const error = err as Error & { stderr?: string };
    logger.error('ffmpeg', 'Clip normalization failed', {
      acceleration,
      binary: FFMPEG_BIN,
      inputFile: path.basename(inputPath),
      outputFile: path.basename(outputPath),
      stderr: error.stderr,
      error,
    });
    throw new Error(`Unable to process clip "${path.basename(inputPath)}". Check the file and try again.`);
  }
}

function buildConcatCopyArgs(concatListPath: string, outputPath: string): string[] {
  return [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatListPath,
    '-map', '0:v:0',
    '-map', '0:a?',
    '-c', 'copy',
    '-movflags', '+faststart',
    outputPath,
  ];
}

function buildConcatReencodeArgs(
  concatListPath: string,
  outputPath: string,
  acceleration: ProcessingAcceleration
): string[] {
  return [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatListPath,
    '-map', '0:v:0',
    '-map', '0:a?',
    ...buildVideoEncoderArgs(acceleration),
    ...OUTPUT_AUDIO_ARGS,
    '-movflags', '+faststart',
    outputPath,
  ];
}

export async function concatenateClips(
  options: ConcatenationOptions
): Promise<ConcatenationResult> {
  const { clipPaths, outputPath, concatListPath, acceleration } = options;

  // Write the list file for FFmpeg's concat demuxer.
  const listContent = clipPaths
    .map((p) => `file '${p.replace(/\\/g, '/')}'`)
    .join('\n');

  await fs.writeFile(concatListPath, listContent, 'utf-8');

  logger.info('ffmpeg', 'Concatenating normalized clips', {
    clipCount: clipPaths.length,
    outputFile: path.basename(outputPath),
    acceleration,
  });

  try {
    await runFfmpegCommand(buildConcatCopyArgs(concatListPath, outputPath));
    logger.info('ffmpeg', 'Final export completed by stream copy', {
      outputFile: path.basename(outputPath),
    });

    return {
      mode: 'copy',
      videoEncoder: 'copy',
    };
  } catch (err: unknown) {
    const error = err as Error & { stderr?: string };
    logger.warn('ffmpeg', 'Stream-copy concat failed; retrying with re-encode', {
      binary: FFMPEG_BIN,
      outputFile: path.basename(outputPath),
      acceleration,
      stderr: error.stderr,
      error,
    });
  }

  await fs.rm(outputPath, { force: true });

  try {
    await runFfmpegCommand(buildConcatReencodeArgs(concatListPath, outputPath, acceleration));
    logger.info('ffmpeg', 'Final export completed after concat re-encode fallback', {
      outputFile: path.basename(outputPath),
      acceleration,
    });

    return {
      mode: 'reencode',
      videoEncoder: acceleration === 'gpu' ? NVIDIA_GPU_VIDEO_ENCODER : 'libx264',
    };
  } catch (err: unknown) {
    const error = err as Error & { stderr?: string };
    logger.error('ffmpeg', 'Final export failed', {
      binary: FFMPEG_BIN,
      outputFile: path.basename(outputPath),
      acceleration,
      stderr: error.stderr,
      error,
    });
    throw new Error('Unable to merge clips into the final export. Please try again.');
  }
}

function buildXfadeFilterComplex(
  clipCount: number,
  clipDurations: number[],
  requestedTransitionDur: number
): { filterComplex: string; videoOutLabel: string; audioOutLabel: string } {
  const transitionCount = clipCount - 1;
  const videoFilters: string[] = [];
  const audioFilters: string[] = [];

  let runningDuration = clipDurations[0]!;
  let prevVideoLabel = '0:v';
  let prevAudioLabel = '0:a';

  for (let i = 0; i < transitionCount; i++) {
    const curDur = i === 0 ? clipDurations[0]! : clipDurations[i]!;
    const nextDur = clipDurations[i + 1]!;
    const effectiveDur = Math.min(requestedTransitionDur, curDur * 0.4, nextDur * 0.4);

    const offset = runningDuration - effectiveDur;

    const nextClipIdx = i + 1;
    const vOutLabel = `v${String(i).padStart(2, '0')}`;
    const aOutLabel = `a${String(i).padStart(2, '0')}`;

    videoFilters.push(
      `[${prevVideoLabel}][${nextClipIdx}:v]xfade=transition=fade:duration=${effectiveDur.toFixed(4)}:offset=${offset.toFixed(4)}[${vOutLabel}]`
    );
    audioFilters.push(
      `[${prevAudioLabel}][${nextClipIdx}:a]acrossfade=d=${effectiveDur.toFixed(4)}:c1=tri:c2=tri[${aOutLabel}]`
    );

    prevVideoLabel = vOutLabel;
    prevAudioLabel = aOutLabel;
    runningDuration = offset + nextDur;
  }

  return {
    filterComplex: [...videoFilters, ...audioFilters].join('; '),
    videoOutLabel: `[${prevVideoLabel}]`,
    audioOutLabel: `[${prevAudioLabel}]`,
  };
}

export async function mergeWithTransitions(
  options: TransitionMergeOptions
): Promise<TransitionMergeResult> {
  const { clipPaths, clipDurations, transitionDurationSec, outputPath, acceleration } = options;

  const { filterComplex, videoOutLabel, audioOutLabel } =
    buildXfadeFilterComplex(clipPaths.length, clipDurations, transitionDurationSec);

  const inputArgs = clipPaths.flatMap((p) => ['-i', p]);

  const args = [
    '-y',
    ...inputArgs,
    '-filter_complex', filterComplex,
    '-map', videoOutLabel,
    '-map', audioOutLabel,
    ...buildVideoEncoderArgs(acceleration),
    ...OUTPUT_AUDIO_ARGS,
    '-movflags', '+faststart',
    '-video_track_timescale', OUTPUT_VIDEO_TRACK_TIMESCALE,
    outputPath,
  ];

  logger.info('ffmpeg', 'Merging clips with crossfade transitions', {
    clipCount: clipPaths.length,
    transitionDurationSec,
    outputFile: path.basename(outputPath),
    acceleration,
  });

  try {
    await runFfmpegCommand(args);
    logger.info('ffmpeg', 'Crossfade merge completed', {
      outputFile: path.basename(outputPath),
    });
    return {
      videoEncoder: acceleration === 'gpu' ? NVIDIA_GPU_VIDEO_ENCODER : 'libx264',
    };
  } catch (err: unknown) {
    const error = err as Error & { stderr?: string };
    logger.error('ffmpeg', 'Crossfade merge failed', {
      binary: FFMPEG_BIN,
      outputFile: path.basename(outputPath),
      acceleration,
      stderr: error.stderr,
      error,
    });
    throw new Error('Crossfade merge failed. The export will retry with hard cuts.');
  }
}
