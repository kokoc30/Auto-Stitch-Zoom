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
import {
  getDownloadUrl,
  getPreviewUrl,
  openProcessingStatusStream,
  parseProcessingStatusEvent,
  startProcessingJob,
  type ProcessingStep,
} from '../features/processing/processing.api';

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
  processingStatus: ProcessingStatus;
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
  addToast: (text: string, type: ToastMessage['type']) => void;
  dismissToast: (id: string) => void;
  startProcessing: () => Promise<void>;
  resetProcessing: () => void;
};

type ProcessingStateSlice = Pick<
  ClipStore,
  | 'processingStatus'
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
// Keep the current SSE connection around so reset/restart can close it.
let activeEventSource: EventSource | null = null;
const initialDefaultZoom = readStoredDefaultZoom();

function closeActiveProcessingConnection() {
  if (activeEventSource) {
    activeEventSource.close();
    activeEventSource = null;
  }
}

function getIdleProcessingState(): ProcessingStateSlice {
  return {
    processingStatus: 'idle',
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
  processingStatus: ProcessingStatus
): Partial<ProcessingStateSlice> {
  if (processingStatus === 'processing') {
    return {};
  }

  // If the project changes after a finished run, clear the old output state.
  closeActiveProcessingConnection();
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
    const { clips, isUploading, zoomPercent, getProcessingOptions, processingStatus } = get();

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
        ...getInvalidatedProcessingState(current.processingStatus),
      });
    }
  },

  removeClip: (id) => {
    const current = get();
    const nextClips = current.clips.filter((c) => c.id !== id);

    if (nextClips.length === current.clips.length) {
      return;
    }

    set({
      clips: nextClips,
      ...getInvalidatedProcessingState(current.processingStatus),
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
      ...getInvalidatedProcessingState(current.processingStatus),
    });
  },

  clearClips: () => {
    closeActiveProcessingConnection();
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
      ...getInvalidatedProcessingState(current.processingStatus),
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
      ...getInvalidatedProcessingState(current.processingStatus),
    });
  },

  setTransitionEnabled: (enabled) => {
    const current = get();
    if (enabled === current.transitionEnabled) return;
    set({
      transitionEnabled: enabled,
      ...getInvalidatedProcessingState(current.processingStatus),
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
    } = get();

    const validationMessage = getStartValidationMessage();
    if (!canStartProcessing()) {
      addToast(validationMessage || 'Project is not ready to process yet.', 'error');
      return;
    }

    set({
      processingStatus: 'processing',
      outputUrl: null,
      errorMessage: null,
      processingStep: 'validating',
      currentStepLabel: 'Starting...',
      progressPercent: 0,
      processingClipIndex: 0,
      processingTotalClips: clips.length,
    });

    try {
      const clipFilenames = clips.map((c) => c.filename);
      const processingOptions = getProcessingOptions();

      if (!processingOptions) {
        const msg = 'Project settings are not resolved yet.';
        set(buildProcessingErrorState(msg, 'Project not ready'));
        addToast(msg, 'error');
        return;
      }

      const data = await startProcessingJob({
        clipFilenames,
        processingOptions,
      });

      if (!data.success || !data.jobId) {
        const msg = data.error || 'Failed to start processing.';
        set(buildProcessingErrorState(msg, 'Failed to start'));
        addToast(msg, 'error');
        return;
      }

      const jobId = data.jobId;

      closeActiveProcessingConnection();

      const eventSource = openProcessingStatusStream(jobId);
      activeEventSource = eventSource;

      eventSource.onmessage = (event) => {
        const status = parseProcessingStatusEvent(event.data);

        if (!status) {
          console.warn('[sse] Failed to parse SSE message:', event.data);
          return;
        }

        set({
          processingStep: status.status,
          currentStepLabel: status.currentStep,
          progressPercent: status.progress,
          processingClipIndex: status.clipIndex,
          processingTotalClips: status.totalClips,
        });

        if (status.status === 'done') {
          set({
            processingStatus: 'done',
            outputUrl: getDownloadUrl(jobId),
            previewUrl: getPreviewUrl(jobId),
          });
          addToast('Processing complete! Your video is ready to download.', 'info');
          eventSource.close();
          activeEventSource = null;
        } else if (status.status === 'error') {
          const msg = status.error || 'Processing failed unexpectedly.';
          set(buildProcessingErrorState(msg, status.currentStep || 'Processing failed'));
          addToast(msg, 'error');
          eventSource.close();
          activeEventSource = null;
        }
      };

      eventSource.onerror = () => {
        const current = get().processingStatus;
        if (current === 'processing') {
          set(
            buildProcessingErrorState(
              'Lost connection to the server during processing.',
              'Connection lost'
            )
          );
          addToast('Lost connection to the server. Please try again.', 'error');
        }
        eventSource.close();
        activeEventSource = null;
      };
    } catch (err) {
      console.error('[processing] Network error:', err);
      const msg = 'Processing failed. Check that the server is running.';
      set(buildProcessingErrorState(msg, 'Network error'));
      addToast(msg, 'error');
    }
  },

  resetProcessing: () => {
    closeActiveProcessingConnection();
    set(getIdleProcessingState());
  },
}));
