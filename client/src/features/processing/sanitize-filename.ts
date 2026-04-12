const RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

const MAX_STEM_LENGTH = 128;

export function sanitizeFilename(raw: string): string | null {
  let stem = raw.trim();

  if (stem.toLowerCase().endsWith('.mp4')) {
    stem = stem.slice(0, -4);
  }

  // eslint-disable-next-line no-control-regex
  stem = stem.replace(/[\x00-\x1f<>:"/\\|?*]/g, '');
  stem = stem.replace(/\s+/g, ' ');
  stem = stem.replace(/^[.\s]+|[.\s]+$/g, '');

  if (stem.length === 0) return null;
  if (RESERVED_NAMES.has(stem.toUpperCase())) return null;

  if (stem.length > MAX_STEM_LENGTH) {
    stem = stem.slice(0, MAX_STEM_LENGTH).trimEnd();
  }

  return `${stem}.mp4`;
}
