export type OutputResolution = {
    width: number;
    height: number;
};
export type ClipEditSettings = {
    trimStartSec?: number | undefined;
    trimEndSec?: number | undefined;
    zoomPercentOverride?: number | undefined;
    muted?: boolean | undefined;
};
export type TransitionSettings = {
    enabled: boolean;
    durationSec: number;
};
export type ProcessingOptions = {
    zoomPercent: number;
    outputResolution: OutputResolution;
    clipEdits?: Record<string, ClipEditSettings> | undefined;
    exportFilenameBase?: string | undefined;
    transitionSettings?: TransitionSettings | undefined;
};
//# sourceMappingURL=processing.types.d.ts.map