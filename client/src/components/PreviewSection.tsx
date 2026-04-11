import { useClipStore } from '../store/useClipStore';

export function PreviewSection() {
  const processingStatus = useClipStore((s) => s.processingStatus);
  const previewUrl = useClipStore((s) => s.previewUrl);
  const getOutputResolution = useClipStore((s) => s.getOutputResolution);

  if (processingStatus !== 'done' || !previewUrl) return null;

  const outputResolution = getOutputResolution();

  return (
    <div className="panel px-5 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="eyebrow">Step 5 Preview output</div>
            <h2 className="mt-3 text-2xl font-semibold text-white">Review the merged video.</h2>
            <p className="section-copy mt-2.5 max-w-md">
              This inline preview streams the same processed output you can download below.
            </p>
          </div>

          {outputResolution && (
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <span className="data-pill normal-case tracking-normal text-white">
                {outputResolution.width}x{outputResolution.height}
              </span>
              <span className="data-pill normal-case tracking-normal">Preview stream</span>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-[24px] border border-[rgba(155,182,214,0.14)] bg-[linear-gradient(180deg,rgba(7,15,27,0.95),rgba(4,10,19,0.94))] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <video
            data-testid="preview-video"
            controls
            preload="metadata"
            src={previewUrl}
            className="w-full max-h-[420px] rounded-[18px] object-contain"
            style={{ backgroundColor: '#05070b' }}
          />
        </div>

        <p className="fine-print">
          Confirm pacing, crop, and clip order here before downloading the final file.
        </p>
      </div>
    </div>
  );
}
