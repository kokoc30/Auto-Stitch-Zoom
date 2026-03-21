export const ACCEPTED_EXTENSIONS = ['.mp4', '.mov', '.webm'] as const;
export const ACCEPTED_TYPES = 'video/mp4,video/quicktime,video/webm';

export type UploadValidationResult = {
  valid: File[];
  errors: string[];
};

export function validateUploadFiles(files: File[]): UploadValidationResult {
  const valid: File[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const ext = `.${file.name.split('.').pop()?.toLowerCase()}`;

    if (!ACCEPTED_EXTENSIONS.includes(ext as (typeof ACCEPTED_EXTENSIONS)[number])) {
      errors.push(`"${file.name}" is not a supported format. Use .mp4, .mov, or .webm`);
      continue;
    }

    if (file.size === 0) {
      errors.push(`"${file.name}" is empty (0 bytes).`);
      continue;
    }

    valid.push(file);
  }

  return { valid, errors };
}
