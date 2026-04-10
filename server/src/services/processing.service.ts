import path from 'node:path';
import fs from 'node:fs/promises';
import { UPLOAD_BASE_DIR } from '../config/upload.config.js';
import { extractMetadata } from './metadata.service.js';
import { normalizeAndZoomClip, concatenateClips, mergeWithTransitions } from './ffmpeg.service.js';
import { jobStore } from './jobStore.js';
import { resolveProcessingAcceleration } from './video-acceleration.service.js';
import { logger } from '../utils/logger.js';
import type { ProcessingOptions } from '../types/processing.types.js';

export type ProcessingRequest = {
  clipFilenames: string[];
  processingOptions: ProcessingOptions;
};

export type ProcessingResult = {
  jobId: string;
  outputFilename: string;
  outputPath: string;
  outputWidth: number;
  outputHeight: number;
  outputFrameRate: number;
  clipCount: number;
  accelerationMode: 'gpu' | 'cpu';
  concatMode: 'copy' | 'reencode' | 'xfade';
  warning?: string | undefined;
};

// Runs one job from start to finish and keeps the SSE progress updated.
export async function processClips(
  jobId: string,
  request: ProcessingRequest
): Promise<ProcessingResult> {
  const { clipFilenames, processingOptions } = request;
  const { zoomPercent, outputResolution } = processingOptions;
  const zoomFactor = zoomPercent / 100;
  const totalClips = clipFilenames.length;

  const clipProgress = (clipIdx: number) =>
    Math.round(10 + (clipIdx / totalClips) * 75);

  jobStore.updateJob(jobId, {
    status: 'validating',
    currentStep: 'Validating uploaded clips...',
    totalClips,
    progress: 0,
  });

  const incomingDir = path.join(UPLOAD_BASE_DIR, 'incoming');
  const inputPaths: string[] = [];

  for (const filename of clipFilenames) {
    const clipPath = path.join(incomingDir, filename);
    try {
      await fs.access(clipPath);
      inputPaths.push(clipPath);
    } catch {
      const errMsg = `Clip file not found: "${filename}". It may have been deleted or never uploaded.`;
      jobStore.updateJob(jobId, { status: 'error', currentStep: 'Validation failed', error: errMsg });
      logger.warn('processing', 'Input clip missing during validation', {
        jobId,
        filename,
      });
      throw new Error(errMsg);
    }
  }

  jobStore.updateJob(jobId, { progress: 5, currentStep: `Validated ${inputPaths.length} clips` });
  logger.info('processing', 'Validated processing inputs', {
    jobId,
    clipCount: inputPaths.length,
    zoomPercent,
  });

  jobStore.updateJob(jobId, {
    status: 'resolving',
    currentStep: 'Detecting output resolution...',
    progress: 7,
  });

  let outputWidth: number;
  let outputHeight: number;
  let outputFrameRate = 30;

  if (outputResolution) {
    outputWidth = outputResolution.width;
    outputHeight = outputResolution.height;
    const firstMeta = await extractMetadata(inputPaths[0]!);
    if (firstMeta.frameRate && Number.isFinite(firstMeta.frameRate) && firstMeta.frameRate >= 1) {
      outputFrameRate = Math.round(firstMeta.frameRate * 1000) / 1000;
    }
  } else {
    const firstMeta = await extractMetadata(inputPaths[0]!);
    if (!firstMeta.width || !firstMeta.height) {
      const errMsg = 'Could not detect resolution from the first clip. Please try re-uploading.';
      jobStore.updateJob(jobId, { status: 'error', currentStep: 'Resolution detection failed', error: errMsg });
      logger.warn('processing', 'Failed to resolve output resolution from first clip', {
        jobId,
        firstClip: path.basename(inputPaths[0]!),
        metadata: firstMeta,
      });
      throw new Error(errMsg);
    }
    outputWidth = firstMeta.width;
    outputHeight = firstMeta.height;
    if (firstMeta.frameRate && Number.isFinite(firstMeta.frameRate) && firstMeta.frameRate >= 1) {
      outputFrameRate = Math.round(firstMeta.frameRate * 1000) / 1000;
    }
  }

  outputWidth = Math.ceil(outputWidth / 2) * 2;
  outputHeight = Math.ceil(outputHeight / 2) * 2;

  jobStore.updateJob(jobId, {
    progress: 10,
    currentStep: `Output: ${outputWidth}x${outputHeight}`,
  });

  logger.info('processing', 'Resolved output resolution', {
    jobId,
    outputWidth,
    outputHeight,
    outputFrameRate,
  });

  const jobDir = path.join(UPLOAD_BASE_DIR, 'jobs', jobId);
  const processedDir = path.join(jobDir, 'processed');
  const outputDir = path.join(jobDir, 'output');

  await fs.mkdir(processedDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });

  const processedPaths: string[] = [];
  const accelerationDecision = await resolveProcessingAcceleration();
  let normalizationAcceleration = accelerationDecision.resolvedMode;

  logger.info('processing', 'Resolved processing acceleration', {
    jobId,
    requestedMode: accelerationDecision.requestedMode,
    resolvedMode: normalizationAcceleration,
    gpuAvailable: accelerationDecision.gpuAvailable,
    reason: accelerationDecision.reason,
  });

  async function normalizeAllClips(acceleration: 'gpu' | 'cpu'): Promise<void> {
    processedPaths.length = 0;
    await fs.rm(processedDir, { recursive: true, force: true });
    await fs.mkdir(processedDir, { recursive: true });

    for (let i = 0; i < inputPaths.length; i++) {
      const inputPath = inputPaths[i]!;
      const intermediateName = `clip_${String(i + 1).padStart(3, '0')}.mp4`;
      const intermediatePath = path.join(processedDir, intermediateName);
      const clipMetadata = await extractMetadata(inputPath);

      jobStore.updateJob(jobId, {
        status: 'processing',
        currentStep: `Processing clip ${i + 1} of ${totalClips}...`,
        clipIndex: i,
        progress: clipProgress(i),
      });

      logger.info('processing', 'Processing clip', {
        jobId,
        acceleration,
        clipNumber: i + 1,
        totalClips,
        filename: path.basename(inputPath),
      });

      await normalizeAndZoomClip({
        inputPath,
        outputPath: intermediatePath,
        outputWidth,
        outputHeight,
        zoomFactor,
        outputFrameRate,
        hasAudio: clipMetadata.hasAudio === true,
        acceleration,
      });

      processedPaths.push(intermediatePath);

      jobStore.updateJob(jobId, {
        progress: clipProgress(i + 1),
        currentStep: `Clip ${i + 1} of ${totalClips} complete`,
      });
    }
  }

  try {
    await normalizeAllClips(normalizationAcceleration);
  } catch (error) {
    if (normalizationAcceleration !== 'gpu') {
      throw error;
    }

    logger.warn('processing', 'GPU normalization failed; restarting the job on CPU', {
      jobId,
      error,
    });

    normalizationAcceleration = 'cpu';

    jobStore.updateJob(jobId, {
      status: 'processing',
      clipIndex: 0,
      progress: 10,
      currentStep: 'GPU processing failed. Restarting on CPU...',
    });

    await normalizeAllClips(normalizationAcceleration);
  }

  const outputFilename = `final-output-${jobId.slice(0, 8)}.mp4`;
  const outputPath = path.join(outputDir, outputFilename);
  const concatListPath = path.join(jobDir, 'concat-list.txt');

  // Resolve transition settings (default: enabled, 0.3s crossfade).
  const defaultTransition = { enabled: true, durationSec: 0.3 };
  const transitionSettings = processingOptions.transitionSettings ?? defaultTransition;
  let useTransitions = transitionSettings.enabled && processedPaths.length > 1;
  let transitionFallbackWarning: string | undefined;

  // Validate preconditions for xfade path.
  let clipDurations: number[] = [];
  if (useTransitions) {
    jobStore.updateJob(jobId, {
      status: 'merging',
      currentStep: 'Preparing crossfade merge...',
      progress: 86,
    });

    const clipHasAudio: boolean[] = [];
    for (const processedPath of processedPaths) {
      const meta = await extractMetadata(processedPath);
      clipDurations.push(meta.duration ?? -1);
      clipHasAudio.push(meta.hasAudio === true);
    }

    const allDurationsValid = clipDurations.every((d) => d > 0 && Number.isFinite(d));
    const allHaveAudio = clipHasAudio.every(Boolean);

    let allTransitionsSafe = false;
    if (allDurationsValid) {
      allTransitionsSafe = clipDurations.every(
        (d, i, arr) =>
          i === arr.length - 1 ||
          Math.min(transitionSettings.durationSec, d * 0.4, arr[i + 1]! * 0.4) >= 0.05
      );
    }

    if (!allDurationsValid || !allHaveAudio || !allTransitionsSafe) {
      useTransitions = false;
      transitionFallbackWarning =
        'Crossfade transitions could not be applied (clip metadata issue). Output uses hard cuts.';
      logger.warn('processing', 'Transition preconditions not met; falling back to hard-cut merge', {
        jobId,
        allDurationsValid,
        allHaveAudio,
        allTransitionsSafe,
      });
    }
  }

  let concatMode: 'copy' | 'reencode' | 'xfade';

  if (useTransitions) {
    jobStore.updateJob(jobId, {
      status: 'merging',
      currentStep: 'Merging clips with crossfade transitions...',
      progress: 88,
    });

    logger.info('processing', 'Starting crossfade merge', {
      jobId,
      clipCount: processedPaths.length,
      transitionDurationSec: transitionSettings.durationSec,
      acceleration: normalizationAcceleration,
    });

    try {
      await mergeWithTransitions({
        clipPaths: processedPaths,
        clipDurations,
        transitionDurationSec: transitionSettings.durationSec,
        outputPath,
        acceleration: normalizationAcceleration,
      });
      concatMode = 'xfade';
    } catch (transitionError) {
      logger.warn('processing', 'Crossfade merge failed; falling back to hard-cut merge', {
        jobId,
        error: transitionError,
      });

      await fs.rm(outputPath, { force: true });

      transitionFallbackWarning =
        'Crossfade transitions could not be applied. Output uses hard cuts.';

      jobStore.updateJob(jobId, {
        currentStep: 'Transitions unavailable — merging with hard cuts...',
        progress: 90,
      });

      const concatResult = await concatenateClips({
        clipPaths: processedPaths,
        outputPath,
        concatListPath,
        acceleration: normalizationAcceleration,
      });
      concatMode = concatResult.mode;
    }
  } else {
    jobStore.updateJob(jobId, {
      status: 'merging',
      currentStep: 'Merging clips into final video...',
      progress: 88,
    });

    logger.info('processing', 'Starting hard-cut merge', {
      jobId,
      clipCount: processedPaths.length,
      acceleration: normalizationAcceleration,
    });

    const concatResult = await concatenateClips({
      clipPaths: processedPaths,
      outputPath,
      concatListPath,
      acceleration: normalizationAcceleration,
    });
    concatMode = concatResult.mode;
  }

  try {
    const stat = await fs.stat(outputPath);
    logger.info('processing', 'Processing job completed', {
      jobId,
      accelerationMode: normalizationAcceleration,
      concatMode,
      outputFilename,
      outputSizeMb: Number((stat.size / (1024 * 1024)).toFixed(1)),
      transitionFallbackWarning,
    });
  } catch {
    const errMsg = 'Processing completed but the output file was not created. Check FFmpeg logs.';
    jobStore.updateJob(jobId, { status: 'error', currentStep: 'Output verification failed', error: errMsg });
    logger.error('processing', 'Output verification failed after export', {
      jobId,
      outputPath,
    });
    throw new Error(errMsg);
  }

  jobStore.updateJob(jobId, {
    status: 'done',
    currentStep: transitionFallbackWarning
      ? 'Done — transitions were not applied'
      : 'Processing complete!',
    progress: 100,
  });

  return {
    jobId,
    outputFilename,
    outputPath,
    outputWidth,
    outputHeight,
    outputFrameRate,
    clipCount: inputPaths.length,
    accelerationMode: normalizationAcceleration,
    concatMode,
    warning: transitionFallbackWarning,
  };
}
