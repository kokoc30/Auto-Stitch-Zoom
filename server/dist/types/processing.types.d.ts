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
export type ProcessingOptions = {
    zoomPercent: number;
    outputResolution: OutputResolution;
    clipEdits?: Record<string, ClipEditSettings> | undefined;
    exportFilenameBase?: string | undefined;
};
//# sourceMappingURL=processing.types.d.ts.map