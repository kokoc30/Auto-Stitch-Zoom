import { describe, it, expect, beforeEach } from 'vitest';
import {
  storeFileRef,
  getFileRef,
  removeFileRef,
  clearFileRefs,
} from '../file-store';

function fakeFile(name: string): File {
  return new File(['content'], name, { type: 'video/mp4' });
}

describe('file-store', () => {
  beforeEach(() => {
    clearFileRefs();
  });

  it('stores and retrieves a file reference', () => {
    const file = fakeFile('clip.mp4');
    storeFileRef('clip-1', file);
    expect(getFileRef('clip-1')).toBe(file);
  });

  it('returns undefined for unknown clip IDs', () => {
    expect(getFileRef('nope')).toBeUndefined();
  });

  it('overwrites an existing reference', () => {
    const file1 = fakeFile('a.mp4');
    const file2 = fakeFile('b.mp4');
    storeFileRef('clip-1', file1);
    storeFileRef('clip-1', file2);
    expect(getFileRef('clip-1')).toBe(file2);
  });

  it('removes a single reference', () => {
    storeFileRef('clip-1', fakeFile('a.mp4'));
    storeFileRef('clip-2', fakeFile('b.mp4'));
    removeFileRef('clip-1');
    expect(getFileRef('clip-1')).toBeUndefined();
    expect(getFileRef('clip-2')).toBeDefined();
  });

  it('clearFileRefs removes all references', () => {
    storeFileRef('clip-1', fakeFile('a.mp4'));
    storeFileRef('clip-2', fakeFile('b.mp4'));
    clearFileRefs();
    expect(getFileRef('clip-1')).toBeUndefined();
    expect(getFileRef('clip-2')).toBeUndefined();
  });

  it('removeFileRef is safe on missing IDs', () => {
    expect(() => removeFileRef('nonexistent')).not.toThrow();
  });
});
