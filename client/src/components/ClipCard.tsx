import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, Film, Clock, Monitor, FileVideo } from 'lucide-react';
import type { ClipItem } from '../types/clip';

function formatDuration(seconds?: number): string {
  if (seconds === undefined || seconds === null) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFormatTag(filename: string): string {
  const ext = filename.split('.').pop()?.toUpperCase();
  return ext ?? '';
}

type ClipCardProps = {
  clip: ClipItem;
  index: number;
  onRemove: (id: string) => void;
  disabled?: boolean;
};

export function ClipCard({ clip, index, onRemove, disabled = false }: ClipCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: clip.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? ('relative' as const) : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex items-center gap-4 rounded-[20px] border px-4 py-3.5 transition duration-200 ${
        isDragging
          ? 'border-[rgba(125,211,252,0.52)] bg-[linear-gradient(180deg,rgba(15,36,60,0.98),rgba(9,22,38,0.96))] shadow-[0_34px_90px_-56px_rgba(56,189,248,0.9)]'
          : 'border-[rgba(155,182,214,0.12)] bg-[rgba(9,20,34,0.72)] hover:border-[rgba(178,208,244,0.22)]'
      } ${disabled ? 'opacity-70' : ''}`}
    >
      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          disabled={disabled}
          className={`icon-shell h-9 w-9 touch-none transition ${
            disabled
              ? 'cursor-not-allowed opacity-45'
              : 'cursor-grab active:cursor-grabbing hover:border-[rgba(178,208,244,0.34)] hover:text-white'
          }`}
          title="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={18} />
        </button>

        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(178,208,244,0.18)] bg-[rgba(10,22,37,0.86)] text-[10px] font-semibold text-[var(--text-muted)] shadow-inner shadow-black/20 select-none">
          {String(index + 1).padStart(2, '0')}
        </div>
      </div>

      {clip.thumbnailUrl ? (
        <div className="overflow-hidden rounded-[18px] border border-[rgba(178,208,244,0.14)] bg-[rgba(5,12,20,0.9)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <img
            src={clip.thumbnailUrl}
            alt={clip.originalName}
            className="h-[58px] w-[92px] shrink-0 object-cover"
          />
        </div>
      ) : (
        <div className="flex h-[58px] w-[92px] shrink-0 items-center justify-center rounded-[18px] border border-[rgba(178,208,244,0.14)] bg-[linear-gradient(180deg,rgba(12,28,46,0.9),rgba(7,18,31,0.96))]">
          <Film className="h-5 w-5 text-[var(--text-soft)]" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white" title={clip.originalName}>
              {clip.originalName}
            </p>
            <p className="fine-print mt-1">Export position {index + 1}</p>
          </div>

          <span className="supporting-label">{getFormatTag(clip.originalName)}</span>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5 text-xs text-[var(--text-muted)]">
          {clip.duration !== undefined && (
            <span className="metric-chip">
              <Clock size={11} />
              {formatDuration(clip.duration)}
            </span>
          )}
          {clip.width && clip.height && (
            <span className="metric-chip">
              <Monitor size={11} />
              {clip.width}x{clip.height}
            </span>
          )}
          {clip.fileSize && (
            <span className="metric-chip">
              <FileVideo size={11} />
              {formatSize(clip.fileSize)}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={() => onRemove(clip.id)}
        disabled={disabled}
        className={`ghost-button min-h-[40px] min-w-[40px] px-2.5 py-2.5 ${
          disabled
            ? 'cursor-not-allowed opacity-45'
            : 'text-[var(--text-soft)] hover:bg-[rgba(251,113,133,0.1)] hover:text-[#ffd7de]'
        }`}
        title="Remove clip"
        aria-label={`Remove ${clip.originalName}`}
      >
        <X size={18} />
      </button>
    </div>
  );
}
