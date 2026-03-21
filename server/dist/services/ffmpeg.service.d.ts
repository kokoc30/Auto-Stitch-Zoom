/**
 * Normalizes a single clip: scales up by zoom factor, then center-crops
 * to the target output frame size. Encodes as H.264/AAC intermediate.
 *
 * @param inputPath  - Absolute path to the source clip
 * @param outputPath - Absolute path for the normalized intermediate output
 * @param outputWidth  - Target output frame width (e.g. 1080)
 * @param outputHeight - Target output frame height (e.g. 1920)
 * @param zoomFactor   - Zoom multiplier (e.g. 1.09 for 109%)
 */
export declare function normalizeAndZoomClip(inputPath: string, outputPath: string, outputWidth: number, outputHeight: number, zoomFactor: number, outputFrameRate: number, hasAudio: boolean): Promise<void>;
/**
 * Concatenates multiple normalized clips into one final output using
 * the FFmpeg concat demuxer and a final compatibility-focused encode.
 *
 * All input clips MUST have matching stream structure, frame size, and frame rate
 * (which is intended to be guaranteed after normalizeAndZoomClip).
 *
 * @param clipPaths  - Ordered list of intermediate clip paths
 * @param outputPath - Absolute path for the final merged output
 * @param concatListPath - Path to write the temporary concat list file
 */
export declare function concatenateClips(clipPaths: string[], outputPath: string, concatListPath: string): Promise<void>;
//# sourceMappingURL=ffmpeg.service.d.ts.map