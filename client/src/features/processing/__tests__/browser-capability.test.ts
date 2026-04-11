import { describe, it, expect, beforeEach } from 'vitest';
import { resolveAutoMode, detectBrowserCapability } from '../browser-capability';
import type { ClipItem } from '../../../types/clip';
import type { ProcessingOptions } from '../../../types/processing';

function makeClip(overrides: Partial<ClipItem> = {}): ClipItem {
  return {
    id: 'clip-1',
    filename: 'clip-1',
    originalName: 'test.mp4',
    duration: 5,
    width: 1080,
    height: 1920,
    fileSize: 10 * 1024 * 1024,
    ...overrides,
  };
}

function makeOptions(overrides: Partial<ProcessingOptions> = {}): ProcessingOptions {
  return {
    zoomPercent: 109,
    outputResolution: { width: 1080, height: 1920 },
    transitionSettings: { enabled: false, durationSec: 0.3 },
    ...overrides,
  };
}

describe('detectBrowserCapability', () => {
  it('reports crossOriginIsolated from globalThis', () => {
    const original = globalThis.crossOriginIsolated;
    Object.defineProperty(globalThis, 'crossOriginIsolated', {
      value: true,
      writable: true,
      configurable: true,
    });

    expect(detectBrowserCapability().crossOriginIsolated).toBe(true);

    Object.defineProperty(globalThis, 'crossOriginIsolated', {
      value: original,
      writable: true,
      configurable: true,
    });
  });
});

describe('resolveAutoMode', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'crossOriginIsolated', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  it('chooses browser for a lightweight single clip', () => {
    const decision = resolveAutoMode([makeClip()], makeOptions());
    expect(decision.mode).toBe('browser');
  });

  it('chooses browser for 3 clips within limits', () => {
    const clips = [
      makeClip({ id: '1', duration: 8, fileSize: 20 * 1024 * 1024 }),
      makeClip({ id: '2', duration: 8, fileSize: 20 * 1024 * 1024 }),
      makeClip({ id: '3', duration: 8, fileSize: 20 * 1024 * 1024 }),
    ];
    const decision = resolveAutoMode(clips, makeOptions());
    expect(decision.mode).toBe('browser');
  });

  it('chooses server when crossOriginIsolated is false', () => {
    Object.defineProperty(globalThis, 'crossOriginIsolated', {
      value: false,
      writable: true,
      configurable: true,
    });

    const decision = resolveAutoMode([makeClip()], makeOptions());
    expect(decision.mode).toBe('server');
    expect(decision.reason).toMatch(/cross-origin/i);
  });

  it('chooses server when clip count exceeds limit', () => {
    const clips = Array.from({ length: 4 }, (_, i) =>
      makeClip({ id: `clip-${i}`, duration: 5, fileSize: 5 * 1024 * 1024 }),
    );
    const decision = resolveAutoMode(clips, makeOptions());
    expect(decision.mode).toBe('server');
    expect(decision.reason).toMatch(/clips/i);
  });

  it('chooses server when total size exceeds 100 MB', () => {
    const clips = [
      makeClip({ id: '1', fileSize: 60 * 1024 * 1024 }),
      makeClip({ id: '2', fileSize: 60 * 1024 * 1024 }),
    ];
    const decision = resolveAutoMode(clips, makeOptions());
    expect(decision.mode).toBe('server');
    expect(decision.reason).toMatch(/size/i);
  });

  it('chooses server when total duration exceeds 30 seconds', () => {
    const clips = [
      makeClip({ id: '1', duration: 20 }),
      makeClip({ id: '2', duration: 15 }),
    ];
    const decision = resolveAutoMode(clips, makeOptions());
    expect(decision.mode).toBe('server');
    expect(decision.reason).toMatch(/duration/i);
  });

  it('chooses server when transitions are enabled with multiple clips', () => {
    const clips = [
      makeClip({ id: '1', duration: 5 }),
      makeClip({ id: '2', duration: 5 }),
    ];
    const opts = makeOptions({
      transitionSettings: { enabled: true, durationSec: 0.3 },
    });
    const decision = resolveAutoMode(clips, opts);
    expect(decision.mode).toBe('server');
    expect(decision.reason).toMatch(/transition/i);
  });

  it('allows browser when transitions are enabled but only one clip', () => {
    const opts = makeOptions({
      transitionSettings: { enabled: true, durationSec: 0.3 },
    });
    const decision = resolveAutoMode([makeClip()], opts);
    expect(decision.mode).toBe('browser');
  });

  it('treats missing fileSize as 0 for size check', () => {
    const clips = [makeClip({ fileSize: undefined })];
    const decision = resolveAutoMode(clips, makeOptions());
    expect(decision.mode).toBe('browser');
  });

  it('treats missing duration as 0 for duration check', () => {
    const clips = [makeClip({ duration: undefined })];
    const decision = resolveAutoMode(clips, makeOptions());
    expect(decision.mode).toBe('browser');
  });
});
