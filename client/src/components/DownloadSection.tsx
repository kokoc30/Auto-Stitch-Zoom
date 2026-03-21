import { Download } from 'lucide-react';
import { useClipStore } from '../store/useClipStore';

export function DownloadSection() {
  const processingStatus = useClipStore((s) => s.processingStatus);
  const outputUrl = useClipStore((s) => s.outputUrl);
  const getOutputResolution = useClipStore((s) => s.getOutputResolution);

  if (processingStatus !== 'done' || !outputUrl) return null;

  const res = getOutputResolution();
  const resText = res ? `${res.width}x${res.height}` : 'original resolution';

  return (
    <div className="panel px-5 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="eyebrow">Step 6 Download final</div>
            <h2 className="mt-3 text-2xl font-semibold text-white">Save the finished export.</h2>
            <p className="section-copy mt-2.5 max-w-md">
              The final file is ready to post and stays valid until you change the clip order or zoom.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
            <span className="data-pill normal-case tracking-normal text-white">MP4 export</span>
            <span className="data-pill normal-case tracking-normal">H.264 + AAC</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="metric-chip">Resolution {resText}</span>
          <span className="metric-chip">Quality-first H.264</span>
          <span className="metric-chip">Ready for social upload</span>
        </div>

        <a
          href={outputUrl}
          download="final-output.mp4"
          className="inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[20px] border border-white/80 bg-white px-4 py-3.5 text-sm font-semibold text-[#03121d] transition duration-200 shadow-[0_20px_48px_-28px_rgba(255,255,255,0.5)] hover:-translate-y-0.5 hover:bg-[#f4fbff] active:translate-y-0"
        >
          <Download size={20} />
          Download final video
        </a>

        <p className="fine-print">
          Re-downloads are safe. If you reorder clips or adjust zoom, the app clears this result
          and asks for a fresh export so the downloaded file never goes stale.
        </p>
      </div>
    </div>
  );
}
