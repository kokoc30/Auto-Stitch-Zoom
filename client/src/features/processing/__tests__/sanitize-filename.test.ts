import { describe, it, expect } from 'vitest';
import { sanitizeFilename } from '../sanitize-filename';

describe('sanitizeFilename', () => {
  it('returns a valid .mp4 filename from plain text', () => {
    expect(sanitizeFilename('my summer clips')).toBe('my summer clips.mp4');
  });

  it('strips a trailing .mp4 before processing', () => {
    expect(sanitizeFilename('my summer clips.mp4')).toBe('my summer clips.mp4');
  });

  it('is case-insensitive when stripping .mp4', () => {
    expect(sanitizeFilename('my summer clips.MP4')).toBe('my summer clips.mp4');
  });

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeFilename('  hello world  ')).toBe('hello world.mp4');
  });

  it('collapses repeated whitespace', () => {
    expect(sanitizeFilename('a   b    c')).toBe('a b c.mp4');
  });

  it('strips control characters', () => {
    expect(sanitizeFilename('hello\x00world\x1f')).toBe('helloworld.mp4');
  });

  it('strips forbidden filename characters', () => {
    expect(sanitizeFilename('a<b>c:d"e/f\\g|h?i*j')).toBe('abcdefghij.mp4');
  });

  it('trims leading and trailing dots', () => {
    expect(sanitizeFilename('...test...')).toBe('test.mp4');
  });

  it('returns null for empty input', () => {
    expect(sanitizeFilename('')).toBeNull();
  });

  it('returns null for whitespace-only input', () => {
    expect(sanitizeFilename('   ')).toBeNull();
  });

  it('returns null for input that becomes empty after sanitization', () => {
    expect(sanitizeFilename('<>:"/\\|?*')).toBeNull();
  });

  it('rejects Windows reserved names', () => {
    expect(sanitizeFilename('CON')).toBeNull();
    expect(sanitizeFilename('con')).toBeNull();
    expect(sanitizeFilename('PRN')).toBeNull();
    expect(sanitizeFilename('AUX')).toBeNull();
    expect(sanitizeFilename('NUL')).toBeNull();
    expect(sanitizeFilename('COM1')).toBeNull();
    expect(sanitizeFilename('COM9')).toBeNull();
    expect(sanitizeFilename('LPT1')).toBeNull();
    expect(sanitizeFilename('LPT9')).toBeNull();
  });

  it('rejects reserved names case-insensitively', () => {
    expect(sanitizeFilename('Con')).toBeNull();
    expect(sanitizeFilename('nul')).toBeNull();
    expect(sanitizeFilename('Lpt3')).toBeNull();
  });

  it('allows reserved names as substrings', () => {
    expect(sanitizeFilename('CONTROL')).toBe('CONTROL.mp4');
    expect(sanitizeFilename('my CON video')).toBe('my CON video.mp4');
  });

  it('caps stem to 128 characters', () => {
    const long = 'a'.repeat(200);
    const result = sanitizeFilename(long);
    expect(result).toBe('a'.repeat(128) + '.mp4');
  });

  it('trims trailing space after truncation', () => {
    const stem = 'a'.repeat(127) + ' b';
    const result = sanitizeFilename(stem);
    expect(result).toBe('a'.repeat(127) + '.mp4');
  });

  it('preserves unicode characters', () => {
    expect(sanitizeFilename('café été')).toBe('café été.mp4');
  });

  it('handles mixed valid and invalid characters', () => {
    expect(sanitizeFilename('my:video<2024>')).toBe('myvideo2024.mp4');
  });

  it('returns null for .mp4 alone', () => {
    expect(sanitizeFilename('.mp4')).toBeNull();
  });

  it('handles dots-only input', () => {
    expect(sanitizeFilename('...')).toBeNull();
  });
});
