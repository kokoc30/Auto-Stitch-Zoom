import path from 'node:path';
import fs from 'node:fs/promises';
import { UPLOAD_BASE_DIR } from '../config/upload.config.js';
import { extractMetadata } from './metadata.service.js';
import { normalizeAndZoomClip, concatenateClips } from './ffmpeg.service.js';
import { jobStore } from './jobStore.js';
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
      clipNumber: i + 1,
      totalClips,
      filename: path.basename(inputPath),
    });

    await normalizeAndZoomClip(
      inputPath,
      intermediatePath,
      outputWidth,
      outputHeight,
      zoomFactor,
      outputFrameRate,
      clipMetadata.hasAudio === true
    );

    processedPaths.push(intermediatePath);

    jobStore.updateJob(jobId, {
      progress: clipProgress(i + 1),
      currentStep: `Clip ${i + 1} of ${totalClips} complete`,
    });
  }

  jobStore.updateJob(jobId, {
    status: 'concatenating',
    currentStep: 'Merging clips into final video...',
    progress: 88,
  });

  const outputFilename = `final-output-${jobId.slice(0, 8)}.mp4`;
  const outputPath = path.join(outputDir, outputFilename);
  const concatListPath = path.join(jobDir, 'concat-list.txt');

  logger.info('processing', 'Starting final concatenation', {
    jobId,
    clipCount: processedPaths.length,
  });

  await concatenateClips(processedPaths, outputPath, concatListPath);

  try {
    const stat = await fs.stat(outputPath);
    logger.info('processing', 'Processing job completed', {
      jobId,
      outputFilename,
      outputSizeMb: Number((stat.size / (1024 * 1024)).toFixed(1)),
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
    currentStep: 'Processing complete!',
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
  };
}
