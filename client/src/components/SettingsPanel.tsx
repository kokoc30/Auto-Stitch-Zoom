import { RotateCcw } from 'lucide-react';
import { useClipStore } from '../store/useClipStore';
import { MIN_ZOOM, MAX_ZOOM } from '../features/settings/zoomSettings';

type SettingsPanelProps = {
  embedded?: boolean;
};

export function SettingsPanel({ embedded = false }: SettingsPanelProps) {
  const zoomPercent = useClipStore((s) => s.zoomPercent);
  const defaultZoomPercent = useClipStore((s) => s.defaultZoomPercent);
  const processingStatus = useClipStore((s) => s.processingStatus);
  const setZoomPercent = useClipStore((s) => s.setZoomPercent);
  const resetZoom = useClipStore((s) => s.resetZoom);
  const transitionEnabled = useClipStore((s) => s.transitionEnabled);
  const setTransitionEnabled = useClipStore((s) => s.setTransitionEnabled);
  const clipCount = useClipStore((s) => s.clips.length);
  const isProcessing = processingStatus === 'processing';

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseInt(e.target.value, 10);
    setZoomPercent(num);
  };

  const isDefault = zoomPercent === defaultZoomPercent;

  const content = (
    <div className="flex flex-col gap-4">
      <div className="max-w-sm">
        <div className="eyebrow">Step 3 Zoom settings</div>
        <h2 className="mt-2.5 text-xl font-semibold text-white sm:text-[1.4rem]">
          Set the export crop.
        </h2>
        <p className="fine-print mt-1.5">
          One zoom applies to every clip and stays centered on the resolved output frame.
        </p>
      </div>

      <div
        className={
          embedded
            ? 'rounded-[20px] border border-[rgba(155,182,214,0.14)] bg-[rgba(8,19,33,0.54)] px-4 py-4'
            : 'surface-muted p-3.5'
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="supporting-label">Zoom</p>

            <div className="flex items-center gap-2.5">
              <button
                onClick={resetZoom}
                disabled={isDefault || isProcessing}
                className="secondary-button min-w-[114px]"
                title={`Use saved default (${defaultZoomPercent}%)`}
              >
                <RotateCcw size={14} />
                Use default
              </button>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="supporting-label">Scale</span>
              <span className="text-sm font-semibold tabular-nums text-white">
                {zoomPercent}%
              </span>
            </div>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={1}
              value={zoomPercent}
              onChange={handleSliderChange}
              disabled={isProcessing}
              className="studio-range cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            />
            <div className="mt-2 flex justify-between text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-soft)]">
              <span>{MIN_ZOOM}%</span>
              <span>{MAX_ZOOM}%</span>
            </div>
          </div>
        </div>
      </div>

      {clipCount > 1 && (
        <div
          className={
            embedded
              ? 'rounded-[20px] border border-[rgba(155,182,214,0.14)] bg-[rgba(8,19,33,0.54)] px-4 py-4'
              : 'surface-muted p-3.5'
          }
        >
          <label className="flex items-center justify-between gap-3">
            <div>
              <p className="supporting-label">Crossfade between clips</p>
              <p className="fine-print mt-0.5">Subtle dissolve at each cut point</p>
            </div>
            <input
              type="checkbox"
              checked={transitionEnabled}
              onChange={(e) => setTransitionEnabled(e.target.checked)}
              disabled={isProcessing}
              className="studio-checkbox h-5 w-5 cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
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
