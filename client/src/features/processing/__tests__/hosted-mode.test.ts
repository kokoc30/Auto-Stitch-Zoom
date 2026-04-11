import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

async function loadModulesWithHostedFlag(flag: boolean) {
  vi.resetModules();
  vi.doMock('../hosted-mode', () => ({ HOSTED_BROWSER_ONLY: flag }));
  const processingMode = await import('../processing-mode');
  const processor = await import('../processor');
  return { processingMode, processor };
}

describe('hosted browser-only mode', () => {
  const originalLocalStorage = globalThis.localStorage;
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    const mockStorage: Storage = {
      get length() {
        return Object.keys(store).length;
      },
      clear: () => {
        store = {};
      },
      getItem: (key: string) => (key in store ? store[key]! : null),
      key: (i: number) => Object.keys(store)[i] ?? null,
      removeItem: (key: string) => {
        delete store[key];
      },
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(globalThis, 'crossOriginIsolated', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      configurable: true,
      writable: true,
    });
    vi.doUnmock('../hosted-mode');
    vi.resetModules();
  });

  it('defaults to browser and rewrites a stale server localStorage value', async () => {
    store['auto-stitch-zoom.processing-mode'] = 'server';
    const { processingMode } = await loadModulesWithHostedFlag(true);

    expect(processingMode.DEFAULT_PROCESSING_MODE).toBe('browser');
    expect(processingMode.readStoredProcessingMode()).toBe('browser');
    expect(store['auto-stitch-zoom.processing-mode']).toBe('browser');
  });

  it('rewrites a stale auto localStorage value to browser', async () => {
    store['auto-stitch-zoom.processing-mode'] = 'auto';
    const { processingMode } = await loadModulesWithHostedFlag(true);

    expect(processingMode.readStoredProcessingMode()).toBe('browser');
    expect(store['auto-stitch-zoom.processing-mode']).toBe('browser');
  });

  it('reports only browser as a supported mode under the hosted flag', async () => {
    const { processingMode } = await loadModulesWithHostedFlag(true);

    expect(processingMode.isProcessingModeSupported('browser')).toBe(true);
    expect(processingMode.isProcessingModeSupported('server')).toBe(false);
    expect(processingMode.isProcessingModeSupported('auto')).toBe(false);
  });

  it('createProcessor never returns a ServerProcessor in hosted mode', async () => {
    const { processor } = await loadModulesWithHostedFlag(true);

    const forServer = processor.createProcessor('server');
    const forAuto = processor.createProcessor('auto');
    const forBrowser = processor.createProcessor('browser');

    // 'server' and 'browser' collapse to BrowserProcessor; 'auto' still runs
    // the AutoProcessor so its workload-reason error path can fire.
    expect(forServer.mode).toBe('browser');
    expect(forBrowser.mode).toBe('browser');
    expect(forAuto.mode).toBe('auto');
  });

  it('AutoProcessor throws ServerProcessingDisabledError on over-cap workload and makes no network call', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const { processor } = await loadModulesWithHostedFlag(true);
    const auto = processor.createProcessor('auto');

    // 7 clips exceeds the 6-clip cap, so the policy returns mode 'server'.
    const overCapClips = Array.from({ length: 7 }, (_, i) =>
      makeClip({ id: `clip-${i}`, duration: 5, fileSize: 5 * 1024 * 1024 }),
    );

    await expect(
      auto.start(overCapClips, makeOptions(), () => {}),
    ).rejects.toMatchObject({
      name: 'ServerProcessingDisabledError',
      code: 'SERVER_PROCESSING_DISABLED',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('non-hosted builds keep server and auto as supported modes', async () => {
    const { processingMode } = await loadModulesWithHostedFlag(false);

    expect(processingMode.DEFAULT_PROCESSING_MODE).toBe('server');
    expect(processingMode.isProcessingModeSupported('server')).toBe(true);
    expect(processingMode.isProcessingModeSupported('auto')).toBe(true);
    expect(processingMode.isProcessingModeSupported('browser')).toBe(true);
  });
});
