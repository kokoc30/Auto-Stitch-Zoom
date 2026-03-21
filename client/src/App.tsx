import { useState } from 'react';
import {
  ArrowUpDown,
  Download,
  Eye,
  Play,
  Settings2,
  Sparkles,
  Upload,
  WandSparkles,
} from 'lucide-react';
import { UploadArea } from './components/UploadArea';
import { ClipList } from './components/ClipList';
import { SettingsPanel } from './components/SettingsPanel';
import { AppSettingsModal } from './components/AppSettingsModal';
import { ResolutionInfo } from './components/ResolutionInfo';
import { ProcessingSection } from './components/ProcessingSection';
import { DownloadSection } from './components/DownloadSection';
import { PreviewSection } from './components/PreviewSection';
import { ToastContainer } from './components/Toast';
import { useClipStore } from './store/useClipStore';

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const defaultZoomPercent = useClipStore((s) => s.defaultZoomPercent);
  const clips = useClipStore((s) => s.clips);
  const processingStatus = useClipStore((s) => s.processingStatus);
  const outputUrl = useClipStore((s) => s.outputUrl);

  const clipCount = clips.length;
  const projectStatus =
    processingStatus === 'processing'
      ? 'Export running'
      : outputUrl
        ? 'Final output ready'
        : clipCount > 0
          ? 'Project ready'
          : 'Waiting for clips';

  const workflowSteps = [
    { icon: Upload, label: 'Upload' },
    { icon: ArrowUpDown, label: 'Order' },
    { icon: Settings2, label: 'Zoom' },
    { icon: Play, label: 'Process' },
    { icon: Eye, label: 'Preview' },
    { icon: Download, label: 'Download' },
  ] as const;

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-4 sm:px-6 sm:py-6 xl:px-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[540px] w-[540px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(125,211,252,0.22),_transparent_68%)] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(145,172,208,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(145,172,208,0.08)_1px,transparent_1px)] [background-size:78px_78px] [mask-image:linear-gradient(180deg,rgba(0,0,0,0.48),transparent_82%)] opacity-20" />
      </div>

      <div className="relative mx-auto flex max-w-[1480px] flex-col gap-6">
        <header className="panel px-5 py-3.5 sm:px-6 sm:py-4">
          <div className="flex flex-col gap-3.5">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="eyebrow">
                    <Sparkles className="h-3.5 w-3.5" />
                    Creator workflow
                  </div>
                  <div className="metric-chip">Short-form vertical</div>
                  <div className="metric-chip">Saved default zoom {defaultZoomPercent}%</div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="icon-shell h-9 w-9 shrink-0">
                    <WandSparkles className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="font-display text-[1.42rem] font-semibold text-white sm:text-[1.58rem]">
                      Auto Stitch &amp; Zoom
                    </p>
                  </div>
                </div>
              </div>

              <div className="surface-muted flex flex-col gap-3 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="supporting-label">Project status</p>
                    <p className="mt-1.5 text-lg font-display font-semibold text-white">
                      {projectStatus}
                    </p>
                  </div>
                  <span className="data-pill normal-case tracking-normal text-white">
                    {clipCount} clip{clipCount === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="studio-divider" />

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="supporting-label">Saved default</p>
                    <p className="mt-1.5 text-base font-semibold text-white">
                      {defaultZoomPercent}%
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    className="secondary-button min-w-[150px]"
                  >
                    <Settings2 className="h-4 w-4" />
                    App settings
                  </button>
                </div>
              </div>
            </div>

            <div className="studio-divider" />

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)]">
              <div className="surface-muted flex flex-col gap-3 px-4 py-3">
                <div>
                  <p className="supporting-label">Workflow</p>
                  <p className="fine-print mt-1.5">
                    The visible setup moves straight from upload to final download.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {workflowSteps.map(({ icon: Icon, label }, index) => (
                    <div
                      key={label}
                      className="inline-flex items-center gap-2 rounded-[16px] border border-[rgba(155,182,214,0.14)] bg-[rgba(7,17,31,0.44)] px-3 py-2"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(13,34,58,0.86)] text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                        {index + 1}
                      </span>
                      <Icon className="h-3.5 w-3.5 text-[var(--accent)]" />
                      <span className="text-xs font-semibold text-white">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="surface-muted grid gap-3 p-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <div>
                  <p className="supporting-label">Clips in project</p>
                  <p className="mt-1.5 font-display text-lg font-semibold text-white">
                    {clipCount}
                  </p>
                  <p className="fine-print mt-1.5">Ready until the sequence changes.</p>
                </div>

                <div>
                  <p className="supporting-label">Export rule</p>
                  <p className="mt-1.5 font-display text-lg font-semibold text-white">
                    Keep the frame
                  </p>
                  <p className="fine-print mt-1.5">Center crop with the resolved output size preserved.</p>
                </div>

                <div>
                  <p className="supporting-label">Final result</p>
                  <p className="mt-1.5 font-display text-lg font-semibold text-white">
                    Preview, then download
                  </p>
                  <p className="fine-print mt-1.5">
                    Final output appears only after processing completes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.42fr)_390px]">
          <div className="space-y-6">
            <UploadArea />
            <ClipList />
          </div>
          <div className="space-y-5 xl:sticky xl:top-5">
            <section className="panel px-4 py-4 sm:px-5 sm:py-5">
              <div className="space-y-5">
                <div className="flex flex-col gap-3">
                  <div className="eyebrow eyebrow-muted">Control rail</div>
                  <div>
                    <h2 className="text-xl font-semibold text-white sm:text-[1.4rem]">
                      Dial in zoom and run the export from one place.
                    </h2>
                  </div>
                </div>

                <div className="studio-divider" />

                <SettingsPanel embedded />

                <div className="studio-divider" />

                <ResolutionInfo embedded />

                <div className="studio-divider" />

                <ProcessingSection embedded />
              </div>
            </section>
            <PreviewSection />
            <DownloadSection />
          </div>
        </main>
      </div>

      {isSettingsOpen && <AppSettingsModal onClose={() => setIsSettingsOpen(false)} />}

      <ToastContainer />
    </div>
  );
}

export default App;
