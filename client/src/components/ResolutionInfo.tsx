import { Monitor, AlertTriangle, Check } from 'lucide-react';
import { useClipStore } from '../store/useClipStore';

type ResolutionInfoProps = {
  embedded?: boolean;
};

export function ResolutionInfo({ embedded = false }: ResolutionInfoProps) {
  const clips = useClipStore((s) => s.clips);
  const getOutputResolution = useClipStore((s) => s.getOutputResolution);
  const getResolutionMismatch = useClipStore((s) => s.getResolutionMismatch);
  const getAspectRatioMismatch = useClipStore((s) => s.getAspectRatioMismatch);

  if (clips.length === 0) return null;

  const outputRes = getOutputResolution();
  const hasResolutionMismatch = getResolutionMismatch();
  const hasAspectRatioMismatch = getAspectRatioMismatch();
  const needsNormalizationNotice = hasResolutionMismatch || hasAspectRatioMismatch;

  if (!outputRes) {
    const loadingState = (
      <div className="flex items-start gap-3 rounded-[20px] border border-[rgba(155,182,214,0.14)] bg-[rgba(8,19,33,0.5)] px-4 py-4">
        <div className="icon-shell h-9 w-9 shrink-0">
          <Monitor className="h-4 w-4" />
        </div>
        <div>
          <p className="supporting-label">Output target</p>
          <p className="mt-1.5 text-base font-semibold text-white">Waiting for clip metadata</p>
          <p className="fine-print mt-1.5">
            Resolution metadata is not available yet, so processing stays disabled until the clip
            set can be read correctly.
          </p>
        </div>
      </div>
    );

    if (embedded) {
      return loadingState;
    }

    return (
      <div className="panel px-4 py-4">
        {loadingState}
      </div>
    );
  }

  const isVertical = outputRes.height > outputRes.width;

  const content = (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="icon-shell h-10 w-10 shrink-0">
            <Monitor className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="eyebrow eyebrow-muted">Output target</div>
            <p className="mt-3 text-2xl font-display font-semibold text-white">
              {outputRes.width}x{outputRes.height}
            </p>
            <p className="fine-print mt-1.5">
              The first clip sets the export frame, and the global zoom keeps that frame intact.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <span className="data-pill normal-case tracking-normal text-white">
            {outputRes.width}x{outputRes.height}
          </span>
          <span className="data-pill normal-case tracking-normal">
            {isVertical ? 'Vertical frame' : 'Landscape frame'}
          </span>
        </div>
      </div>

      {needsNormalizationNotice ? (
        <div className="tone-warning flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
          <div>
            <p className="text-sm font-semibold text-white">
              {hasAspectRatioMismatch ? 'Mixed aspect ratios detected' : 'Mixed resolutions detected'}
            </p>
            <p className="fine-print mt-1.5 text-[#f6d38c]">
              The first clip&apos;s resolution ({outputRes.width}x{outputRes.height}) stays the
              output target.{' '}
              {hasAspectRatioMismatch
                ? 'Clips with different aspect ratios will be scaled to cover that frame and center-cropped to fit.'
                : 'Clips with different frame sizes will be scaled to match it before export.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="tone-success flex items-start gap-3">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
          <div>
            <p className="text-sm font-semibold text-white">Frame sizes already match.</p>
            <p className="fine-print mt-1.5 text-[#b9f3ca]">
              All uploaded clips share the same resolution and aspect ratio, so normalization stays
              simple before the final merge.
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
    <div className="panel px-4 py-4">
      {content}
    </div>
  );
}
