import { Play, Loader2, AlertCircle, CheckCircle2, Search, Monitor, Film, Combine } from 'lucide-react';
import { useClipStore } from '../store/useClipStore';

const PIPELINE_STEPS = [
  { key: 'validating', label: 'Validate', icon: Search },
  { key: 'resolving', label: 'Resolution', icon: Monitor },
  { key: 'processing', label: 'Process clips', icon: Film },
  { key: 'merging', label: 'Merge', icon: Combine },
  { key: 'done', label: 'Done', icon: CheckCircle2 },
] as const;

function getStepIndex(step: string | null): number {
  if (!step) return -1;
  const idx = PIPELINE_STEPS.findIndex((s) => s.key === step);
  return idx === -1 ? -1 : idx;
}

function formatProjectDuration(totalDurationSeconds: number): string {
  const rounded = Math.max(0, Math.round(totalDurationSeconds));

  if (rounded < 60) {
    return `~${rounded}s`;
  }

  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;

  return seconds === 0 ? `~${minutes}m` : `~${minutes}m ${seconds}s`;
}

type ProcessingSectionProps = {
  embedded?: boolean;
};

export function ProcessingSection({ embedded = false }: ProcessingSectionProps) {
  const clips = useClipStore((s) => s.clips);
  const isUploading = useClipStore((s) => s.isUploading);
  const zoomPercent = useClipStore((s) => s.zoomPercent);
  const processingStatus = useClipStore((s) => s.processingStatus);
  const errorMessage = useClipStore((s) => s.errorMessage);
  const startProcessing = useClipStore((s) => s.startProcessing);
  const resetProcessing = useClipStore((s) => s.resetProcessing);
  const getOutputResolution = useClipStore((s) => s.getOutputResolution);
  const canStartProcessing = useClipStore((s) => s.canStartProcessing);

  const processingStep = useClipStore((s) => s.processingStep);
  const currentStepLabel = useClipStore((s) => s.currentStepLabel);
  const progressPercent = useClipStore((s) => s.progressPercent);
  const processingClipIndex = useClipStore((s) => s.processingClipIndex);
  const processingTotalClips = useClipStore((s) => s.processingTotalClips);

  const isProcessing = processingStatus === 'processing';
  const isDone = processingStatus === 'done';
  const isError = processingStatus === 'error';
  const canStart = canStartProcessing();
  const totalDurationSeconds = clips.reduce((sum, clip) => sum + (clip.duration ?? 0), 0);
  const formattedDuration = formatProjectDuration(totalDurationSeconds);
  const isRecommendedWorkload = clips.length <= 6 && totalDurationSeconds <= 60;
  const outputResolution = getOutputResolution();
  const compactHelperMessage =
    isUploading
      ? 'Finish uploading to enable export.'
      : clips.length === 0
        ? 'Add clips to enable export.'
        : !outputResolution
          ? 'Waiting for clip metadata.'
          : !canStart
            ? 'Resolve the current setup to continue.'
            : clips.length === 1
              ? 'Single clips export normally.'
              : null;

  const activeStepIndex = getStepIndex(processingStep);

  const handleStart = () => {
    if (canStart) {
      startProcessing();
    }
  };

  const content = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <div className="eyebrow">Step 4 Process export</div>
          <h2 className="mt-2.5 text-xl font-semibold text-white sm:text-[1.4rem]">
            Run the export.
          </h2>
        </div>

        <div className="flex flex-wrap gap-2 self-start">
          {clips.length > 0 && (
            <span className="data-pill normal-case tracking-normal text-white">
              {clips.length} clip{clips.length === 1 ? '' : 's'}
            </span>
          )}
          {clips.length > 0 && totalDurationSeconds > 0 && (
            <span className="data-pill normal-case tracking-normal">{formattedDuration}</span>
          )}
          {clips.length > 0 && (
            <span className="data-pill normal-case tracking-normal">
              {isRecommendedWorkload ? 'Within MVP target' : 'Heavy export'}
            </span>
          )}
          {clips.length > 0 && (
            <span className="data-pill normal-case tracking-normal">
              Zoom {zoomPercent}%
            </span>
          )}
        </div>
      </div>

      {clips.length > 0 && !isRecommendedWorkload && (
        <div className="tone-warning px-3.5 py-3">
          <p className="text-sm font-semibold text-white">Heavier than the MVP target.</p>
          <p className="fine-print mt-1.5 text-[#f6d38c]">
            Export should still run, but normalization and merge time may increase.
          </p>
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={!canStart}
        className={`flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[20px] px-4 py-3.5 text-sm font-semibold transition duration-200 ${
          isProcessing
            ? 'secondary-button cursor-wait border-[rgba(125,211,252,0.28)] bg-[rgba(15,34,57,0.94)] text-[var(--accent)]'
            : 'primary-button'
        }`}
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Processing export...
          </>
        ) : isDone ? (
          <>
            <CheckCircle2 size={20} />
            Reprocess current project
          </>
        ) : (
          <>
            <Play fill="currentColor" size={20} />
            Start processing
          </>
        )}
      </button>

      {compactHelperMessage && !isProcessing && <p className="fine-print">{compactHelperMessage}</p>}

      {isProcessing && (
        <div className="space-y-3">
          <div className="rounded-[20px] border border-[rgba(155,182,214,0.14)] bg-[rgba(8,19,33,0.54)] p-4">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-white">{currentStepLabel || 'Starting...'}</span>
              <span className="font-semibold tabular-nums text-[var(--accent)]">
                {progressPercent}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,rgba(125,211,252,1),rgba(56,189,248,0.58))] transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {processingStep === 'processing' && processingTotalClips > 0 && (
              <div className="mt-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="supporting-label">Clip progress</span>
                  <span className="text-sm font-semibold tabular-nums text-white">
                    {processingClipIndex + 1} / {processingTotalClips}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                  <div
                    className="h-full rounded-full bg-[rgba(125,211,252,0.78)] transition-all duration-300"
                    style={{ width: `${((processingClipIndex + 1) / processingTotalClips) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {PIPELINE_STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = idx === activeStepIndex;
              const isComplete = idx < activeStepIndex || (isDone && step.key === 'done');

              return (
                <div
                  key={step.key}
                  className={`flex items-center gap-2 rounded-full border px-3 py-2 transition duration-200 ${
                    isActive
                      ? 'border-[rgba(125,211,252,0.34)] bg-[rgba(13,34,58,0.92)] shadow-[0_18px_36px_-26px_rgba(56,189,248,0.82)]'
                      : isComplete
                        ? 'border-[rgba(74,222,128,0.22)] bg-[rgba(10,28,21,0.9)]'
                        : 'border-[rgba(155,182,214,0.14)] bg-[rgba(9,20,34,0.84)]'
                  }`}
                >
                  <div
                    className={`icon-shell h-8 w-8 ${
                      isComplete ? 'border-[rgba(74,222,128,0.24)] text-[var(--success)]' : ''
                    } ${isActive ? 'text-[var(--accent)]' : ''}`}
                  >
                    {isActive ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isComplete ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{step.label}</p>
                    <p className="fine-print mt-0.5">
                      {isActive ? 'Running now' : isComplete ? 'Complete' : 'Waiting'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isError && errorMessage && (
        <div className="tone-danger flex items-start gap-3 px-3.5 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
          <div>
            <p className="text-sm font-semibold text-white">Processing failed</p>
            <p className="fine-print mt-1.5 text-[#fecdd3]">{errorMessage}</p>
            <button onClick={resetProcessing} className="ghost-button mt-2.5 px-0 py-0 text-[#fecdd3]">
              Reset status
            </button>
          </div>
        </div>
      )}

      {isDone && (
        <div className="tone-success flex items-start gap-3 px-3.5 py-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
          <div>
            <p className="text-sm font-semibold text-white">Processing complete</p>
            <p className="fine-print mt-1.5 text-[#b9f3ca]">
              Preview and download now match the current order and zoom.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="panel px-4 py-4 sm:px-5 sm:py-5">
      {content}
    </div>
  );
}
