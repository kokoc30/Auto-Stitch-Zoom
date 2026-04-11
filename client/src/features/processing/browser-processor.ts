import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import type { ClipItem } from '../../types/clip';
import type { ProcessingOptions } from '../../types/processing';
import type { ProcessingStatusEvent } from './processing.api';
import type { Processor, ProcessingOutput, ProcessingProgressCallback } from './processor';
import { getFileRef } from './file-store';
import { createManagedBlobUrl } from './blob-url-manager';

// Self-hosted ffmpeg.wasm core assets. Copied from node_modules/@ffmpeg/core
// by scripts/copy-ffmpeg-core.mjs into client/public/ffmpeg/ during prebuild.
// Served same-origin by the production Express server (and Vite dev server),
// which is required under Cross-Origin-Embedder-Policy: require-corp.
//
// We specifically point at the ESM build. @ffmpeg/ffmpeg@0.12.x spawns its
// worker with `type: "module"`, so `importScripts` is unavailable and the
// worker falls back to dynamic `import()` of the core script. That only
// works with the ESM distribution — the UMD build would parse-fail and
// surface as "failed to import ffmpeg-core.js".
const CORE_URL = '/ffmpeg/esm/ffmpeg-core.js';
const WASM_URL = '/ffmpeg/esm/ffmpeg-core.wasm';

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

/**
 * Returns a lazily-loaded, shared FFmpeg instance.
 * The first call downloads the WASM core (~30 MB); subsequent calls reuse it.
 */
async function getFFmpeg(
  onProgress: ProcessingProgressCallback,
  abortCheck: () => boolean,
): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance;

  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();

    onProgress(makeEvent('validating', 'Loading video engine...', 0, 0, 2));

    // Pass same-origin URLs directly — no toBlobURL indirection needed when
    // the assets are served from our own Express server. The @ffmpeg/ffmpeg
    // worker will dynamic-import the ESM core from these paths.
    if (abortCheck()) throw new Error('Processing was cancelled.');
    await ffmpeg.load({ coreURL: CORE_URL, wasmURL: WASM_URL });

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  loadPromise.catch(() => {
    loadPromise = null;
  });

  return loadPromise;
}

function makeEvent(
  status: ProcessingStatusEvent['status'],
  currentStep: string,
  clipIndex: number,
  totalClips: number,
  progress: number,
): ProcessingStatusEvent {
  return { status, currentStep, clipIndex, totalClips, progress };
}

function evenDim(n: number): number {
  return Math.ceil(n / 2) * 2;
}

export class BrowserProcessor implements Processor {
  readonly mode = 'browser' as const;
  readonly resolvedMode = 'browser' as const;
  private aborted = false;
  private ffmpeg: FFmpeg | null = null;

  async start(
    clips: ClipItem[],
    options: ProcessingOptions,
    onProgress: ProcessingProgressCallback,
  ): Promise<ProcessingOutput> {
    this.aborted = false;
    const totalClips = clips.length;

    // --- Stage 1: Load ffmpeg.wasm ---
    if (typeof globalThis !== 'undefined' && globalThis.crossOriginIsolated !== true) {
      throw new Error(
        'Browser video engine requires cross-origin isolation. Your environment does not provide the required headers. Switch to server mode.',
      );
    }

    let ffmpeg: FFmpeg;
    try {
      ffmpeg = await getFFmpeg(onProgress, () => this.aborted);
    } catch (err) {
      if (this.aborted) throw new Error('Processing was cancelled.');
      // Surface the root cause so deployment problems (missing assets,
      // header misconfig, blocked worker) are actionable rather than silent.
      console.error('[browser-processor] ffmpeg.load failed:', err);
      let detail = '';
      if (err instanceof Error && err.message) {
        detail = `: ${err.message}`;
      } else if (err != null) {
        const asString = String(err);
        if (asString && asString !== '[object Object]') detail = `: ${asString}`;
      }
      throw new Error(
        `Browser video engine failed to load${detail}. Switch to server mode or check browser compatibility.`,
      );
    }
    this.ffmpeg = ffmpeg;

    if (this.aborted) throw new Error('Processing was cancelled.');

    // --- Stage 2: Validate & write input files ---
    onProgress(makeEvent('validating', 'Checking clip files...', 0, totalClips, 3));

    const inputNames: string[] = [];
    for (let i = 0; i < clips.length; i++) {
      if (this.aborted) throw new Error('Processing was cancelled.');

      const clip = clips[i]!;
      const file = getFileRef(clip.id);
      if (!file) {
        throw new Error(
          `File not available for browser processing: "${clip.originalName}". Re-upload your clips in browser or auto mode.`,
        );
      }

      const ext = clip.originalName.split('.').pop()?.toLowerCase() ?? 'mp4';
      const inputName = `input_${i}.${ext}`;
      inputNames.push(inputName);

      const data = await fetchFile(file);
      if (this.aborted) throw new Error('Processing was cancelled.');
      await ffmpeg.writeFile(inputName, data);

      onProgress(
        makeEvent('validating', `Loaded ${clip.originalName}`, i, totalClips, 5),
      );
    }

    // --- Stage 3: Resolve output parameters ---
    onProgress(makeEvent('resolving', 'Calculating output settings...', 0, totalClips, 8));

    const { zoomPercent, outputResolution } = options;
    const zoomFactor = zoomPercent / 100;
    const outW = evenDim(outputResolution.width);
    const outH = evenDim(outputResolution.height);
    const scaledW = evenDim(Math.ceil(outW * zoomFactor));
    const scaledH = evenDim(Math.ceil(outH * zoomFactor));

    const vf = [
      `scale=${scaledW}:${scaledH}:force_original_aspect_ratio=increase`,
      `crop=${outW}:${outH}:(in_w-out_w)/2:(in_h-out_h)/2`,
      'setsar=1:1',
      'fps=30',
      'format=yuv420p',
    ].join(',');

    // --- Stage 4: Normalize each clip ---
    const normalizedNames: string[] = [];

    for (let i = 0; i < inputNames.length; i++) {
      if (this.aborted) throw new Error('Processing was cancelled.');

      const inputName = inputNames[i]!;
      const normalizedName = `normalized_${i}.mp4`;
      normalizedNames.push(normalizedName);

      const baseProgress = 10 + (i / totalClips) * 75;
      const clipRange = 75 / totalClips;

      onProgress(
        makeEvent(
          'processing',
          `Normalizing clip ${i + 1} of ${totalClips}...`,
          i,
          totalClips,
          Math.round(baseProgress),
        ),
      );

      const clipProgressHandler = (ev: { progress: number }) => {
        if (this.aborted) return;
        const p = Math.max(0, Math.min(1, ev.progress));
        onProgress(
          makeEvent(
            'processing',
            `Normalizing clip ${i + 1} of ${totalClips}...`,
            i,
            totalClips,
            Math.round(baseProgress + p * clipRange),
          ),
        );
      };

      ffmpeg.on('progress', clipProgressHandler);

      const exitCode = await ffmpeg.exec([
        '-i', inputName,
        '-vf', vf,
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '48000',
        '-ac', '2',
        '-movflags', '+faststart',
        normalizedName,
      ]);

      ffmpeg.off('progress', clipProgressHandler);

      if (this.aborted) throw new Error('Processing was cancelled.');

      if (exitCode !== 0) {
        throw new Error(
          `Failed to process clip ${i + 1} ("${clips[i]!.originalName}"). The file may be unsupported in browser mode.`,
        );
      }

      // Clean up input file to free memory
      await ffmpeg.deleteFile(inputName).catch(() => {});
    }

    // --- Stage 5: Merge ---
    onProgress(makeEvent('merging', 'Merging clips...', 0, totalClips, 88));

    let outputName: string;

    if (normalizedNames.length === 1) {
      outputName = normalizedNames[0]!;
    } else {
      outputName = 'output.mp4';

      const concatList = normalizedNames
        .map((name) => `file '${name}'`)
        .join('\n');

      await ffmpeg.writeFile('concat.txt', concatList);

      // Try stream-copy concat first (fast)
      let mergeCode = await ffmpeg.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat.txt',
        '-c', 'copy',
        outputName,
      ]);

      // Fall back to re-encode if stream-copy fails
      if (mergeCode !== 0) {
        await ffmpeg.deleteFile(outputName).catch(() => {});

        onProgress(makeEvent('merging', 'Re-encoding merge...', 0, totalClips, 90));

        mergeCode = await ffmpeg.exec([
          '-f', 'concat',
          '-safe', '0',
          '-i', 'concat.txt',
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '23',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-b:a', '128k',
          outputName,
        ]);
      }

      if (this.aborted) throw new Error('Processing was cancelled.');

      if (mergeCode !== 0) {
        throw new Error('Failed to merge clips in browser mode.');
      }

      // Clean up intermediate files
      await ffmpeg.deleteFile('concat.txt').catch(() => {});
      for (const name of normalizedNames) {
        await ffmpeg.deleteFile(name).catch(() => {});
      }
    }

    // --- Stage 6: Read output and create blob URLs ---
    onProgress(makeEvent('merging', 'Preparing output...', 0, totalClips, 96));

    const outputData = await ffmpeg.readFile(outputName);
    if (this.aborted) throw new Error('Processing was cancelled.');

    if (typeof outputData === 'string') {
      throw new Error('Unexpected string output from ffmpeg.wasm.');
    }

    const blob = new Blob([new Uint8Array(outputData as Uint8Array)], { type: 'video/mp4' });
    const blobUrl = createManagedBlobUrl(blob);

    // Clean up the output file from virtual FS
    await ffmpeg.deleteFile(outputName).catch(() => {});

    onProgress(makeEvent('done', 'Processing complete!', totalClips, totalClips, 100));

    return {
      previewUrl: blobUrl,
      downloadUrl: blobUrl,
    };
  }

  abort(): void {
    this.aborted = true;
    if (this.ffmpeg?.loaded) {
      this.ffmpeg.terminate();
      ffmpegInstance = null;
      loadPromise = null;
    }
    this.ffmpeg = null;
  }

  dispose(): void {
    this.abort();
  }

}
