type LogMeta = Record<string, unknown> | undefined;
export declare const logger: {
    info(scope: string, message: string, meta?: LogMeta): void;
    warn(scope: string, message: string, meta?: LogMeta): void;
    error(scope: string, message: string, meta?: LogMeta): void;
};
export {};
//# sourceMappingURL=logger.d.ts.map