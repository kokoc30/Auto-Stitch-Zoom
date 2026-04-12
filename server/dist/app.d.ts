import express from 'express';
export interface CreateAppOptions {
    /**
     * Override the shared-link password for this app instance. Defaults to
     * the SHARE_ACCESS_PASSWORD env var. Empty string disables the gate.
     * Primarily useful for integration tests that need to spin up both the
     * gated and un-gated shapes of the app in the same process.
     */
    accessPassword?: string;
}
export declare function createApp(options?: CreateAppOptions): express.Express;
declare const app: express.Express;
export default app;
//# sourceMappingURL=app.d.ts.map