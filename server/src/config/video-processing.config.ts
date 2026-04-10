export type VideoAccelerationMode = 'auto' | 'gpu' | 'cpu';

function parseVideoAccelerationMode(rawValue: string | undefined): VideoAccelerationMode {
  const normalized = rawValue?.trim().toLowerCase();

  if (normalized === 'gpu' || normalized === 'cpu') {
    return normalized;
  }

  return 'auto';
}

export const VIDEO_ACCELERATION = parseVideoAccelerationMode(process.env.VIDEO_ACCELERATION);
