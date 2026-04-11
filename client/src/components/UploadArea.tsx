import { useCallback, useRef, useState } from 'react';
import { UploadCloud, Loader2, Smartphone, Clapperboard } from 'lucide-react';
import { useClipStore } from '../store/useClipStore';
import { uploadVideos } from '../features/uploads/upload.api';
import { createLocalClipItems } from '../features/uploads/local-metadata';
import { storeFileRef } from '../features/processing/file-store';
import {
  ACCEPTED_TYPES,
  validateUploadFiles,
} from '../features/uploads/upload.validation';

export function UploadArea() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const isUploading = useClipStore((s) => s.isUploading);
  const processingStatus = useClipStore((s) => s.processingStatus);
  const processingMode = useClipStore((s) => s.processingMode);
  const setUploading = useClipStore((s) => s.setUploading);
  const addClips = useClipStore((s) => s.addClips);
  const addToast = useClipStore((s) => s.addToast);

  const isProcessing = processingStatus === 'processing';
  const isBusy = isUploading || isProcessing;
  const statusMessage = isUploading
    ? 'Please wait while the new files finish uploading and metadata is extracted.'
    : isProcessing
      ? 'The current export is still processing, so the clip set is temporarily locked to keep the output stable.'
      : null;

  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      const { valid, errors } = validateUploadFiles(files);

      for (const err of errors) {
        addToast(err, 'error');
      }

      if (valid.length === 0) return;

      setUploading(true);

      try {
        if (processingMode === 'browser') {
          // Browser mode: extract metadata locally, no server upload
          const data = await createLocalClipItems(valid);

          if (data.clips.length > 0) {
            addClips(data.clips);
          }

          for (const err of data.errors) {
            addToast(err, 'error');
          }
        } else {
          // Server and auto mode: upload to server
          const data = await uploadVideos(valid);

          if (data.clips && data.clips.length > 0) {
            addClips(data.clips);

            // In auto mode, also store File refs so browser fallback works
            if (processingMode === 'auto') {
              for (let i = 0; i < data.clips.length; i++) {
                const clip = data.clips[i]!;
                const file = valid[i];
                if (file) {
                  storeFileRef(clip.id, file);
                }
              }
            }
          }

          if (data.errors && data.errors.length > 0) {
            for (const err of data.errors) {
              addToast(err, 'error');
            }
          }

          if (
            !data.success &&
            (!data.clips || data.clips.length === 0) &&
            (!data.errors || data.errors.length === 0)
          ) {
            addToast('Upload failed. Please try again.', 'error');
          }
        }
      } catch (err) {
        console.error('[upload] Network error:', err);
        addToast(
          processingMode === 'browser'
            ? 'Failed to read clip files locally.'
            : 'Upload failed. Check that the server is running.',
          'error',
        );
      } finally {
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [addClips, addToast, setUploading, processingMode]
  );

  const handleClick = () => {
    if (!isBusy) {
      fileInputRef.current?.click();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isBusy) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      uploadFiles(e.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="panel px-5 py-4 sm:px-6 sm:py-5">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES}
        onChange={handleFileChange}
        className="hidden"
        data-testid="upload-file-input"
      />

      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-3.5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="eyebrow">Step 1 Upload clips</div>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              Drop in the source clips for this export.
            </h2>
          </div>

          <div className="flex flex-wrap gap-2 self-start">
            <div className="metric-chip">
              <Smartphone className="h-3.5 w-3.5 text-[var(--accent)]" />
              Best with 9:16 clips
            </div>
            <div className="metric-chip">
              <Clapperboard className="h-3.5 w-3.5 text-[var(--accent)]" />
              .mp4, .mov, .webm
            </div>
          </div>
        </div>

        <div
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="button"
          tabIndex={isBusy ? -1 : 0}
          aria-disabled={isBusy}
          className={`relative flex min-h-[204px] cursor-pointer flex-col justify-between overflow-hidden rounded-[28px] border border-dashed px-5 py-4 transition duration-200 sm:px-6 sm:py-5 ${
            isDragOver
              ? 'border-[rgba(125,211,252,0.56)] bg-[linear-gradient(135deg,rgba(56,189,248,0.16),rgba(7,17,31,0.92))] shadow-[0_36px_90px_-56px_rgba(56,189,248,0.95)]'
              : 'border-[rgba(155,182,214,0.24)] bg-[linear-gradient(180deg,rgba(14,31,53,0.92),rgba(8,19,33,0.88))] hover:border-[rgba(125,211,252,0.34)] hover:bg-[linear-gradient(180deg,rgba(16,36,60,0.94),rgba(8,19,33,0.9))]'
          } ${isBusy ? 'pointer-events-none opacity-65' : ''}`}
        >
          <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-[radial-gradient(circle,_rgba(125,211,252,0.16),_transparent_68%)] blur-2xl" />

          <div className="relative flex flex-col gap-5">
            <div className="max-w-2xl">
              <div className="icon-shell h-14 w-14">
                {isBusy ? (
                  <Loader2 className="h-7 w-7 animate-spin" />
                ) : (
                  <UploadCloud className="h-7 w-7" />
                )}
              </div>

              <h3 className="mt-3.5 text-2xl font-semibold text-white">
                {isUploading
                  ? 'Uploading your clips...'
                  : isProcessing
                    ? 'Export is running right now'
                    : isDragOver
                      ? 'Drop the clips to add them'
                      : 'Click or drag your clips into the workspace'}
              </h3>

              {statusMessage && <p className="section-copy mt-2 max-w-xl">{statusMessage}</p>}
            </div>
          </div>

          <div className="relative mt-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <div className="metric-chip">Multiple clips accepted</div>
              <div className="metric-chip">Drag and drop enabled</div>
              <div className="metric-chip">Duplicate names are skipped</div>
            </div>

            <span className="secondary-button pointer-events-none min-w-[132px]">
              {isBusy ? 'Please wait' : 'Browse clips'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
