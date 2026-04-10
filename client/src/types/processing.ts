export type OutputResolution = {
  width: number;
  height: number;
};

export type ClipEditSettings = {
  trimStartSec?: number;
  trimEndSec?: number;
  zoomPercentOverride?: number;
  muted?: boolean;
};

export type TransitionSettings = {
  enabled: boolean;
  durationSec: number;
};

export type ProcessingOptions = {
  zoomPercent: number;
  outputResolution: OutputResolution;
  clipEdits?: Record<string, ClipEditSettings>;
  exportFilenameBase?: string;
  transitionSettings?: TransitionSettings;
};
