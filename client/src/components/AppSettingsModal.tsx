import { useEffect, useState, type FormEvent } from 'react';
import { RotateCcw, Save, Settings2, X } from 'lucide-react';
import { useClipStore } from '../store/useClipStore';
import {
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  isValidZoomPercent,
} from '../features/settings/zoomSettings';

type AppSettingsModalProps = {
  onClose: () => void;
};

export function AppSettingsModal({ onClose }: AppSettingsModalProps) {
  const clips = useClipStore((s) => s.clips);
  const zoomPercent = useClipStore((s) => s.zoomPercent);
  const defaultZoomPercent = useClipStore((s) => s.defaultZoomPercent);
  const setDefaultZoomPercent = useClipStore((s) => s.setDefaultZoomPercent);
  const resetDefaultZoom = useClipStore((s) => s.resetDefaultZoom);
  const addToast = useClipStore((s) => s.addToast);

  const [inputValue, setInputValue] = useState(String(defaultZoomPercent));

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const parsedInput = Number.parseInt(inputValue, 10);
  const inputIsValid = isValidZoomPercent(parsedInput);
  const currentProjectMessage =
    clips.length === 0
      ? 'No clip set is loaded yet, so saving here also updates the project zoom panel immediately.'
      : `Current project zoom stays at ${zoomPercent}% until you change it in the project panel.`;

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!inputIsValid) {
      addToast(`Default zoom must stay between ${MIN_ZOOM}% and ${MAX_ZOOM}%.`, 'error');
      return;
    }

    if (parsedInput === defaultZoomPercent) {
      onClose();
      return;
    }

    setDefaultZoomPercent(parsedInput);
    addToast(`Saved ${parsedInput}% as your default zoom for this browser.`, 'info');
    onClose();
  };

  const handleReset = () => {
    resetDefaultZoom();
    setInputValue(String(DEFAULT_ZOOM));
    addToast('Default zoom restored to 109% for this browser.', 'info');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(3,8,19,0.82)] px-4 py-8 backdrop-blur-xl sm:px-6 sm:py-12"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="panel relative w-full max-w-2xl overflow-hidden px-0 py-0"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-settings-title"
      >
        <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,_rgba(125,211,252,0.16),_transparent_72%)]" />

        <div className="relative border-b border-[var(--line)] px-6 py-6 sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="eyebrow">
                <Settings2 className="h-3.5 w-3.5" />
                App settings
              </div>
              <h2 id="app-settings-title" className="mt-4 text-3xl font-semibold text-white">
                Browser Default Zoom
              </h2>
              <p className="section-copy mt-3 max-w-lg">
                Choose the starting zoom this browser should use for future projects. Current
                project zoom stays independent once you are actively working on a clip set.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="icon-shell h-11 w-11 transition hover:border-[rgba(178,208,244,0.34)] hover:text-white"
              aria-label="Close settings"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="relative space-y-5 px-6 py-6 sm:px-7">
          <div className="surface-muted p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex-1">
                <label htmlFor="default-zoom-input" className="supporting-label">
                  Default Zoom Percent
                </label>
                <p className="fine-print mt-2">
                  Used as the starting zoom on app load in this browser. Accepted range:
                  {' '}
                  {MIN_ZOOM}% to {MAX_ZOOM}%.
                </p>
              </div>

              <div className="data-pill">
                Saved default {defaultZoomPercent}%
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <input
                  id="default-zoom-input"
                  type="number"
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step={1}
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  className="control-input pr-14 text-lg tabular-nums"
                  autoFocus
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-[var(--text-soft)]">
                  %
                </span>
              </div>

              <button
                type="submit"
                className="primary-button"
              >
                <Save className="h-4 w-4" />
                Save default
              </button>
            </div>

            <p
              className={`mt-3 text-xs ${
                inputIsValid ? 'text-[var(--text-soft)]' : 'text-[#fecdd3]'
              }`}
            >
              {inputIsValid
                ? 'Saved locally in this browser only. Nothing is sent to the server.'
                : `Enter a whole number from ${MIN_ZOOM}% to ${MAX_ZOOM}%.`}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="surface-muted p-5">
              <p className="supporting-label">Current project behavior</p>
              <p className="mt-3 text-lg font-semibold text-white">Project zoom stays separate.</p>
              <p className="fine-print mt-2">
                {currentProjectMessage}
              </p>
            </div>

            <div className="surface-muted p-5">
              <p className="supporting-label">Current project zoom</p>
              <p className="mt-3 text-4xl font-display font-semibold text-white">{zoomPercent}%</p>
              <p className="fine-print mt-2">
                Keep using the project zoom panel in the main workflow for the clip set you are
                actively editing.
              </p>
            </div>
          </div>

          <div className="surface-muted p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="supporting-label">Reset behavior</p>
                <p className="mt-3 text-lg font-semibold text-white">Return to the product default</p>
                <p className="fine-print mt-2">
                  Reset restores the browser default back to 109% without touching any server-side
                  processing logic.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleReset}
              disabled={defaultZoomPercent === DEFAULT_ZOOM}
              className="secondary-button"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to 109%
            </button>

            <p className="fine-print sm:max-w-xs sm:text-right">
              Save here for future projects. Use the main zoom panel whenever the current clip set
              needs its own setting.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
