import type { ClipItem } from '../../types/clip';
import type { ProcessingOptions } from '../../types/processing';

/** Path to the self-hosted ffmpeg.wasm core assets (see copy-ffmpeg-core.mjs). */
const FFMPEG_CORE_PROBE_URL = '/ffmpeg/esm/ffmpeg-core.wasm';

/** Maximum number of clips for browser-local processing. */
const MAX_BROWSER_CLIPS = 3;

/** Maximum total file size in bytes (100 MB). */
const MAX_BROWSER_TOTAL_BYTES = 100 * 1024 * 1024;

/** Maximum total duration in seconds. */
const MAX_BROWSER_TOTAL_DURATION_SEC = 30;

export type BrowserCapability = {
  crossOriginIsolated: boolean;
};

export function detectBrowserCapability(): BrowserCapability {
  return {
    crossOriginIsolated:
      typeof globalThis !== 'undefined' &&
      typeof globalThis.crossOriginIsolated === 'boolean' &&
      globalThis.crossOriginIsolated,
  };
}

/**
 * Verifies the self-hosted ffmpeg.wasm core binary is actually reachable.
 *
 * Used by auto-mode to avoid committing to browser processing when the
 * runtime assets are missing (e.g. a deployment that forgot to run the
 * copy-ffmpeg-core prebuild step). Cached after first success so the check
 * runs at most once per page load.
 */
let runtimeAssetCheck: Promise<boolean> | null = null;

export function checkBrowserRuntimeAssets(): Promise<boolean> {
  if (runtimeAssetCheck) return runtimeAssetCheck;

  if (typeof fetch !== 'function') {
    runtimeAssetCheck = Promise.resolve(false);
    return runtimeAssetCheck;
  }

  runtimeAssetCheck = fetch(FFMPEG_CORE_PROBE_URL, { method: 'HEAD' })
    .then((response) => response.ok)
    .catch(() => false)
    .then((ok) => {
      // Only cache successes. If the probe failed (e.g. transient network
      // hiccup), allow a retry on the next call.
      if (!ok) runtimeAssetCheck = null;
      return ok;
    });

  return runtimeAssetCheck;
}

export type AutoModeDecision = {
  mode: 'browser' | 'server';
  reason: string;
};

/**
 * Synchronous policy checks for auto mode (isolation + workload limits).
 * Split out so we can short-circuit before hitting the async runtime probe.
 */
function evaluateAutoPolicy(
  clips: ClipItem[],
  options: ProcessingOptions,
): AutoModeDecision {
  const cap = detectBrowserCapability();

  if (!cap.crossOriginIsolated) {
    return {
      mode: 'server',
      reason: 'Browser video engine requires cross-origin isolation headers.',
    };
  }

  if (clips.length > MAX_BROWSER_CLIPS) {
    return {
      mode: 'server',
      reason: `Too many clips for browser mode (${clips.length} > ${MAX_BROWSER_CLIPS}).`,
    };
  }

  const totalBytes = clips.reduce((sum, c) => sum + (c.fileSize ?? 0), 0);
  if (totalBytes > MAX_BROWSER_TOTAL_BYTES) {
    const totalMB = Math.round(totalBytes / (1024 * 1024));
    return {
      mode: 'server',
      reason: `Total file size too large for browser mode (${totalMB} MB > ${Math.round(MAX_BROWSER_TOTAL_BYTES / (1024 * 1024))} MB).`,
    };
  }

  const totalDuration = clips.reduce((sum, c) => sum + (c.duration ?? 0), 0);
  if (totalDuration > MAX_BROWSER_TOTAL_DURATION_SEC) {
    return {
      mode: 'server',
      reason: `Total duration too long for browser mode (${Math.round(totalDuration)}s > ${MAX_BROWSER_TOTAL_DURATION_SEC}s).`,
    };
  }

  const transitionsActive =
    options.transitionSettings?.enabled === true && clips.length > 1;
  if (transitionsActive) {
    return {
      mode: 'server',
      reason: 'Browser mode does not support crossfade transitions yet.',
    };
  }

  return { mode: 'browser', reason: 'Workload is suitable for browser processing.' };
}

/**
 * Determines whether the given workload should run in the browser or on the server.
 *
 * All checks must pass for browser mode. If any fails, server is chosen with
 * a human-readable reason suitable for UI display.
 *
 * This variant is synchronous — it does NOT verify runtime assets are
 * reachable. Prefer `resolveAutoModeAsync` at processing time.
 */
export function resolveAutoMode(
  clips: ClipItem[],
  options: ProcessingOptions,
): AutoModeDecision {
  return evaluateAutoPolicy(clips, options);
}

/**
 * Async auto-mode resolver that additionally verifies the ffmpeg.wasm
 * runtime assets are reachable before committing to browser processing.
 *
 * This protects against deployments where isolation headers are correct
 * but the /ffmpeg/ static assets are missing (e.g. the prebuild copy step
 * was skipped). In that case auto mode falls back to server cleanly
 * instead of failing mid-processing.
 */
export async function resolveAutoModeAsync(
  clips: ClipItem[],
  options: ProcessingOptions,
): Promise<AutoModeDecision> {
  const policyDecision = evaluateAutoPolicy(clips, options);

  if (policyDecision.mode === 'server') {
    return policyDecision;
  }

  const assetsReachable = await checkBrowserRuntimeAssets();
  if (!assetsReachable) {
    return {
      mode: 'server',
      reason: 'Browser video engine assets are not available on this deployment.',
    };
  }

  return policyDecision;
}
