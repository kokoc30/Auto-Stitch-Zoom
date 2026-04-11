function serializeValue(value) {
    if (value instanceof Error) {
        return {
            name: value.name,
            message: value.message,
            stack: value.stack,
        };
    }
    if (Array.isArray(value)) {
        return value.map((item) => serializeValue(item));
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeValue(item)]));
    }
    return value;
}
function formatLog(level, scope, message, meta) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${scope}] ${message}`;
    if (!meta || Object.keys(meta).length === 0) {
        return prefix;
    }
    return `${prefix} ${JSON.stringify(serializeValue(meta))}`;
}
function writeLog(level, scope, message, meta) {
    const line = formatLog(level, scope, message, meta);
    if (level === 'error') {
        console.error(line);
        return;
    }
    if (level === 'warn') {
        console.warn(line);
        return;
    }
    console.log(line);
}
export const logger = {
    info(scope, message, meta) {
        writeLog('info', scope, message, meta);
    },
    warn(scope, message, meta) {
        writeLog('warn', scope, message, meta);
    },
    error(scope, message, meta) {
        writeLog('error', scope, message, meta);
    },
};
//# sourceMappingURL=logger.js.map