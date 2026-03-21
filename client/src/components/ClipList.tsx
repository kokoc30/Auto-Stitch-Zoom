import { useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ArrowDownUp, Film, Trash2 } from 'lucide-react';
import { useClipStore } from '../store/useClipStore';
import { ClipCard } from './ClipCard';

export function ClipList() {
  const clips = useClipStore((s) => s.clips);
  const isUploading = useClipStore((s) => s.isUploading);
  const processingStatus = useClipStore((s) => s.processingStatus);
  const removeClip = useClipStore((s) => s.removeClip);
  const reorderClips = useClipStore((s) => s.reorderClips);
  const clearClips = useClipStore((s) => s.clearClips);
  const isLocked = isUploading || processingStatus === 'processing';

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (isLocked) return;

      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = clips.findIndex((c) => c.id === active.id);
      const newIndex = clips.findIndex((c) => c.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderClips(oldIndex, newIndex);
      }
    },
    [clips, isLocked, reorderClips]
  );

  if (clips.length === 0) {
    return (
      <div className="panel px-5 py-5 sm:px-6 sm:py-6">
        <div className="max-w-2xl">
          <div className="eyebrow">Step 2 Arrange order</div>
          <h2 className="mt-3 text-2xl font-semibold text-white">Build the export sequence.</h2>
        </div>

        <div className="mt-5 flex min-h-[220px] flex-col items-center justify-center rounded-[24px] border border-dashed border-[rgba(155,182,214,0.18)] bg-[rgba(7,17,31,0.44)] px-5 py-11 text-center">
          <div className="icon-shell h-14 w-14">
            <Film className="h-6 w-6" />
          </div>
          <p className="mt-4 text-base font-semibold text-white">No clips are ready to arrange yet.</p>
          <p className="fine-print mt-1.5 max-w-md">
            Upload a clip set above and each item will appear here with a drag handle, sequence
            number, thumbnail, and metadata.
          </p>
        </div>
      </div>
    );
  }

  const clipIds = clips.map((c) => c.id);

  return (
    <div className="panel px-5 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="eyebrow">Step 2 Arrange order</div>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Lock the story flow before export.
          </h2>
          <p className="section-copy mt-2.5">
            Top to bottom is the exact order the merged video will follow. Reordering or removing a
            clip invalidates any stale output automatically so the export always matches the list.
          </p>
        </div>

        <button
          onClick={clearClips}
          disabled={isLocked}
          className={isLocked ? 'danger-button self-start opacity-45' : 'danger-button self-start'}
          title="Remove all clips"
        >
          <Trash2 size={14} />
          Clear All
        </button>
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-[22px] border border-[rgba(155,182,214,0.14)] bg-[rgba(8,19,33,0.54)] px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="icon-shell h-10 w-10 shrink-0">
            <ArrowDownUp className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Drag into the exact final order.</p>
            <p className="fine-print mt-1">
              The backend processes clips in the same order shown here, so there is no hidden
              mismatch between the interface and the final export.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <span className="data-pill normal-case tracking-normal">
            {clips.length} clip{clips.length === 1 ? '' : 's'} ready
          </span>
          <span className="data-pill normal-case tracking-normal">
            {isLocked ? 'Sequence locked' : 'Order controls live'}
          </span>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={clipIds} strategy={verticalListSortingStrategy}>
          <div className="mt-4 space-y-2.5">
            {clips.map((clip, index) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                index={index}
                onRemove={removeClip}
                disabled={isLocked}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <p className="fine-print mt-4 text-center">
        {isLocked
          ? 'Wait for the current upload or export to finish before changing the clip order.'
          : 'Drag the grip handle to reorder clips. The export will follow this exact order.'}
      </p>
    </div>
  );
}
