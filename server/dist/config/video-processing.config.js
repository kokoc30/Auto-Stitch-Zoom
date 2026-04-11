function parseVideoAccelerationMode(rawValue) {
    const normalized = rawValue?.trim().toLowerCase();
    if (normalized === 'gpu' || normalized === 'cpu') {
        return normalized;
    }
    return 'auto';
}
export const VIDEO_ACCELERATION = parseVideoAccelerationMode(process.env.VIDEO_ACCELERATION);
//# sourceMappingURL=video-processing.config.js.map