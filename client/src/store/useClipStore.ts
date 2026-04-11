import { create } from 'zustand';
import type { ClipItem } from '../types/clip';
import type { ProjectSnapshot } from '../types/project';
import type { ProcessingOptions } from '../types/processing';
import {
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  clampZoomPercent,
  isValidZoomPercent,
  persistDefaultZoom,
  readStoredDefaultZoom,
  resetStoredDefaultZoom,
} from '../features/settings/zoomSettings';
import { type ProcessingStep } from '../features/processing/processing.api';
import {
  createProcessor,
  type Processor,
  type ResolvedProcessingMode,
} from '../features/processing/processor';
import {
  readStoredProcessingMode,
  persistProcessingMode,
  type ProcessingMode,
} from '../features/processing/processing-mode';
import {
  detectBrowserCapability,
  resolveAutoMode,
} from '../features/processing/browser-capability';
import { HOSTED_BROWSER_ONLY } from '../features/processing/hosted-mode';
import {
  isBlobUrl,
  revokeManagedBlobUrl,
  revokeAllManagedBlobUrls,
} from '../features/processing/blob-url-manager';
import { clearFileRefs, removeFileRef } from '../features/processing/file-store';

type ToastMessage = {
  id: string;
  text: string;
  type: 'error' | 'warning' | 'info';
};

type ProcessingStatus = 'idle' | 'processing' | 'done' | 'error';

type ClipStore = {
  clips: ClipItem[];
  isUploading: boolean;
  defaultZoomPercent: number;
  zoomPercent: number;
  transitionEnabled: boolean;
  toasts: ToastMessage[];
  processingMode: ProcessingMode;
  processingStatus: ProcessingStatus;
  activeProcessingMode: ResolvedProcessingMode | null;
  outputUrl: string | null;
  previewUrl: string | null;
  errorMessage: string | null;
  processingStep: ProcessingStep | null;
  currentStepLabel: string | null;
  progressPercent: number;
  processingClipIndex: number;
  processingTotalClips: number;
  getOutputResolution: () => { width: number; height: number } | null;
  getResolutionMismatch: () => boolean;
  getAspectRatioMismatch: () => boolean;
  getProcessingOptions: () => ProcessingOptions | null;
  getProjectSnapshot: () => ProjectSnapshot;
  getStartValidationMessage: () => string | null;
  canStartProcessing: () => boolean;
  addClips: (newClips: ClipItem[]) => void;
  removeClip: (id: string) => void;
  reorderClips: (fromIndex: number, toIndex: number) => void;
  clearClips: () => void;
  setUploading: (uploading: boolean) => void;
  setZoomPercent: (value: number) => void;
  setDefaultZoomPercent: (value: number) => void;
  resetDefaultZoom: () => void;
  resetZoom: () => void;
  setTransitionEnabled: (enabled: boolean) => void;
  setProcessingMode: (mode: ProcessingMode) => void;
  addToast: (text: string, type: ToastMessage['type']) => void;
  dismissToast: (id: string) => void;
  startProcessing: () => Promise<void>;
  resetProcessing: () => void;
};

type ProcessingStateSlice = Pick<
  ClipStore,
  | 'processingStatus'
  | 'activeProcessingMode'
  | 'outputUrl'
  | 'previewUrl'
  | 'errorMessage'
  | 'processingStep'
  | 'currentStepLabel'
  | 'progressPercent'
  | 'processingClipIndex'
  | 'processingTotalClips'
>;

export { DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM };

let toastCounter = 0;
let activeProcessor: Processor | null = null;
const initialDefaultZoom = readStoredDefaultZoom();
const initialProcessingMode = readStoredProcessingMode();

/**
 * beforeunload warning during active processing so users don't accidentally
 * lose work by refreshing or navigating away. Registration is browser-only
 * and explicitly removed on every completion path.
 */
function warnBeforeUnload(e: BeforeUnloadEvent) {
  e.preventDefault();
}

function addBeforeUnloadGuard() {
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', warnBeforeUnload);
  }
}

function removeBeforeUnloadGuard() {
  if (typeof window !== 'undefined') {
    window.removeEventListener('beforeunload', warnBeforeUnload);
  }
}

function closeActiveProcessingConnection() {
  if (activeProcessor) {
    activeProcessor.abort();
    activeProcessor = null;
  }
  removeBeforeUnloadGuard();
}

function getIdleProcessingState(): ProcessingStateSlice {
  return {
    processingStatus: 'idle',
    activeProcessingMode: null,
    outputUrl: null,
    previewUrl: null,
    errorMessage: null,
    processingStep: null,
    currentStepLabel: null,
    progressPercent: 0,
    processingClipIndex: 0,
    processingTotalClips: 0,
  };
}

function getInvalidatedProcessingState(
  processingStatus: ProcessingStatus,
  currentOutputUrl?: string | null,
  currentPreviewUrl?: string | null,
): Partial<ProcessingStateSlice> {
  if (processingStatus === 'processing') {
    return {};
  }

  // If the project changes after a finished run, clear the old output state.
  closeActiveProcessingConnection();

  // Revoke blob URLs from previous browser-mode output
  if (isBlobUrl(currentOutputUrl)) revokeManagedBlobUrl(currentOutputUrl);
  if (isBlobUrl(currentPreviewUrl) && currentPreviewUrl !== currentOutputUrl) {
    revokeManagedBlobUrl(currentPreviewUrl);
  }

  return getIdleProcessingState();
}

function buildProcessingErrorState(message: string, currentStepLabel: string): Partial<ClipStore> {
  return {
    processingStatus: 'error',
    errorMessage: message,
    processingStep: 'error',
    currentStepLabel,
  };
}

export const useClipStore = create<ClipStore>((set, get) => ({
  clips: [],
  isUploading: false,
  defaultZoomPercent: initialDefaultZoom,
  zoomPercent: initialDefaultZoom,
  transitionEnabled: true,
  toasts: [],
  processingMode: initialProcessingMode,
  ...getIdleProcessingState(),

  getOutputResolution: () => {
    const { clips } = get();
    const withRes = clips.filter((c) => c.width && c.height);
    if (withRes.length === 0) return null;
    return { width: withRes[0]!.width!, height: withRes[0]!.height! };
  },

  getResolutionMismatch: () => {
    const { clips } = get();
    const withRes = clips.filter((c) => c.width && c.height);
    if (withRes.length <= 1) return false;
    const first = withRes[0]!;
    return withRes.some((c) => c.width !== first.width || c.height !== first.height);
  },

  getAspectRatioMismatch: () => {
    const { clips } = get();
    const withRes = clips.filter((c) => c.width && c.height);
    if (withRes.length <= 1) return false;

    const first = withRes[0]!;
    const firstRatio = first.width! / first.height!;

    return withRes.some((clip) => {
      const clipRatio = clip.width! / clip.height!;
      return Math.abs(clipRatio - firstRatio) > 0.01;
    });
  },

  getProcessingOptions: () => {
    const { zoomPercent, getOutputResolution, clips, transitionEnabled } = get();
    const outputResolution = getOutputResolution();

    if (!outputResolution) {
      return null;
    }

    const clipEdits = Object.fromEntries(
      clips
        .filter((clip) => clip.edits && Object.keys(clip.edits).length > 0)
        .map((clip) => [clip.filename, clip.edits!])
    );

    return {
      zoomPercent,
      outputResolution,
      clipEdits: Object.keys(clipEdits).length > 0 ? clipEdits : undefined,
      transitionSettings: {
        enabled: transitionEnabled,
        durationSec: 0.3,
      },
    };
  },

  getProjectSnapshot: () => {
    const { clips, getProcessingOptions } = get();

    return {
      clips,
      processingOptions: getProcessingOptions(),
    };
  },

  getStartValidationMessage: () => {
    const { clips, isUploading, zoomPercent, getProcessingOptions, processingStatus, processingMode, transitionEnabled } = get();

    if (processingStatus === 'processing') {
      return 'Processing is already running.';
    }

    if (isUploading) {
      return 'Finish the current upload before starting processing.';
    }

    if (clips.length === 0) {
      return 'Upload at least one valid clip to start.';
    }

    if (!isValidZoomPercent(zoomPercent)) {
      return `Zoom must stay between ${MIN_ZOOM}% and ${MAX_ZOOM}%.`;
    }

    if (!getProcessingOptions()) {
      return 'Output resolution is not resolved yet. Re-upload clips or wait for clip metadata before starting.';
    }

    if (processingMode === 'browser' && !detectBrowserCapability().crossOriginIsolated) {
      return HOSTED_BROWSER_ONLY
        ? 'This deployment processes videos locally in your browser, but cross-origin isolation is missing. Reload the page; if the problem persists your browser may be blocking it.'
        : 'Browser mode is not available here — cross-origin isolation is missing. Switch to server or auto.';
    }

    if (processingMode === 'browser' && transitionEnabled && clips.length > 1) {
      return HOSTED_BROWSER_ONLY
        ? 'Crossfade transitions are not yet supported in local browser processing. Disable transitions to continue.'
        : 'Browser mode does not support crossfade transitions. Disable transitions or switch to server mode.';
    }

    // In hosted browser-only mode, run the browser workload policy
    // synchronously here so over-cap jobs are blocked before any processor
    // starts. Outside hosted mode this is handled inside AutoProcessor and
    // the server pipeline has no such cap, so we skip it.
    if (HOSTED_BROWSER_ONLY && (processingMode === 'browser' || processingMode === 'auto')) {
      const options = getProcessingOptions();
      if (options) {
        const decision = resolveAutoMode(clips, options);
        if (decision.mode === 'server') {
          return `${decision.reason} Processing runs locally in your browser on this deployment — try fewer clips, shorter footage, or smaller files.`;
        }
      }
    }

    return null;
  },

  canStartProcessing: () => get().getStartValidationMessage() === null,

  addClips: (newClips) => {
    const current = get();
    const existingNames = new Set(current.clips.map((c) => c.originalName));
    const accepted: ClipItem[] = [];
    const duplicates: string[] = [];

    for (const clip of newClips) {
      if (existingNames.has(clip.originalName)) {
        duplicates.push(clip.originalName);
      } else {
        accepted.push(clip);
        existingNames.add(clip.originalName);
      }
    }

    if (duplicates.length > 0) {
      current.addToast(
        `Skipped duplicate${duplicates.length > 1 ? 's' : ''}: ${duplicates.join(', ')}`,
        'warning'
      );
    }

    if (accepted.length > 0) {
      set({
        clips: [...current.clips, ...accepted],
        ...getInvalidatedProcessingState(current.processingStatus, current.outputUrl, current.previewUrl),
      });
    }
  },

  removeClip: (id) => {
    const current = get();
    const nextClips = current.clips.filter((c) => c.id !== id);

    if (nextClips.length === current.clips.length) {
      return;
    }

    removeFileRef(id);

    set({
      clips: nextClips,
      ...getInvalidatedProcessingState(current.processingStatus, current.outputUrl, current.previewUrl),
    });
  },

  reorderClips: (fromIndex, toIndex) => {
    const current = get();
    const updated = [...current.clips];
    const [moved] = updated.splice(fromIndex, 1);

    if (!moved) {
      return;
    }

    updated.splice(toIndex, 0, moved);

    set({
      clips: updated,
      ...getInvalidatedProcessingState(current.processingStatus, current.outputUrl, current.previewUrl),
    });
  },

  clearClips: () => {
    closeActiveProcessingConnection();
    clearFileRefs();
    revokeAllManagedBlobUrls();
    set({
      clips: [],
      ...getIdleProcessingState(),
    });
  },

  setZoomPercent: (value) => {
    const current = get();
    const clamped = clampZoomPercent(value);

    if (clamped === current.zoomPercent) {
      return;
    }

    set({
      zoomPercent: clamped,
      ...getInvalidatedProcessingState(current.processingStatus, current.outputUrl, current.previewUrl),
    });
  },

  setDefaultZoomPercent: (value) => {
    const current = get();
    const nextDefaultZoom = persistDefaultZoom(value);

    if (nextDefaultZoom === current.defaultZoomPercent) {
      return;
    }

    set({
      defaultZoomPercent: nextDefaultZoom,
      ...(current.clips.length === 0 ? { zoomPercent: nextDefaultZoom } : {}),
    });
  },

  resetDefaultZoom: () => {
    const current = get();

    if (current.defaultZoomPercent === DEFAULT_ZOOM) {
      return;
    }

    const nextDefaultZoom = resetStoredDefaultZoom();

    set({
      defaultZoomPercent: nextDefaultZoom,
      ...(current.clips.length === 0 ? { zoomPercent: nextDefaultZoom } : {}),
    });
  },

  resetZoom: () => {
    const current = get();

    if (current.zoomPercent === current.defaultZoomPercent) {
      return;
    }

    set({
      zoomPercent: current.defaultZoomPercent,
      ...getInvalidatedProcessingState(current.processingStatus, current.outputUrl, current.previewUrl),
    });
  },

  setTransitionEnabled: (enabled) => {
    const current = get();
    if (enabled === current.transitionEnabled) return;
    set({
      transitionEnabled: enabled,
      ...getInvalidatedProcessingState(current.processingStatus, current.outputUrl, current.previewUrl),
    });
  },

  setProcessingMode: (mode) => {
    const current = get();
    closeActiveProcessingConnection();
    const persisted = persistProcessingMode(mode);
    set({
      processingMode: persisted,
      ...getInvalidatedProcessingState(current.processingStatus, current.outputUrl, current.previewUrl),
    });
  },

  setUploading: (uploading) => {
    set({ isUploading: uploading });
  },

  addToast: (text, type) => {
    const id = `toast-${++toastCounter}`;
    set((state) => ({
      toasts: [...state.toasts, { id, text, type }],
    }));
    setTimeout(() => {
      get().dismissToast(id);
    }, 5000);
  },

  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  startProcessing: async () => {
    const {
      clips,
      getProcessingOptions,
      addToast,
      getStartValidationMessage,
      canStartProcessing,
      processingMode,
    } = get();

    const validationMessage = getStartValidationMessage();
    if (!canStartProcessing()) {
      addToast(validationMessage || 'Project is not ready to process yet.', 'error');
      return;
    }

    const processingOptions = getProcessingOptions();
    if (!processingOptions) {
      const msg = 'Project settings are not resolved yet.';
      set(buildProcessingErrorState(msg, 'Project not ready'));
      addToast(msg, 'error');
      return;
    }

    closeActiveProcessingConnection();

    set({
      processingStatus: 'processing',
      activeProcessingMode:
        processingMode === 'auto' ? null : (processingMode as ResolvedProcessingMode),
      outputUrl: null,
      previewUrl: null,
      errorMessage: null,
      processingStep: 'validating',
      currentStepLabel: 'Starting...',
      progressPercent: 0,
      processingClipIndex: 0,
      processingTotalClips: clips.length,
    });

    addBeforeUnloadGuard();

    const processor = createProcessor(processingMode);
    activeProcessor = processor;

    try {
      const output = await processor.start(clips, processingOptions, (event) => {
        // For auto mode, the delegate is chosen inside processor.start().
        // Read resolvedMode on every progress tick so the UI can reveal it
        // as soon as auto has committed to browser or server.
        const resolved = processor.resolvedMode;
        const nextActive =
          get().activeProcessingMode ?? (resolved ?? null);

        set({
          processingStep: event.status,
          currentStepLabel: event.currentStep,
          progressPercent: event.progress,
          processingClipIndex: event.clipIndex,
          processingTotalClips: event.totalClips,
          activeProcessingMode: nextActive,
        });
      });

      set({
        processingStatus: 'done',
        outputUrl: output.downloadUrl,
        previewUrl: output.previewUrl,
      });
      addToast('Processing complete! Your video is ready to download.', 'info');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Processing failed unexpectedly.';
      set(buildProcessingErrorState(msg, 'Processing failed'));
      addToast(msg, 'error');
    } finally {
      activeProcessor = null;
      removeBeforeUnloadGuard();
    }
  },

  resetProcessing: () => {
    const current = get();
    closeActiveProcessingConnection();
    removeBeforeUnloadGuard();
    if (isBlobUrl(current.outputUrl)) revokeManagedBlobUrl(current.outputUrl);
    if (isBlobUrl(current.previewUrl) && current.previewUrl !== current.outputUrl) {
      revokeManagedBlobUrl(current.previewUrl);
    }
    set(getIdleProcessingState());
  },
}));
