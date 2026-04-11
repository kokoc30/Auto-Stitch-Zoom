/**
 * Single source of truth for the hosted browser-only deployment profile.
 *
 * When `VITE_HOSTED_BROWSER_ONLY=true` is set at build time, the client is
 * built for a deployment (e.g. Render Free) where server-side processing is
 * disabled. All export work must stay in BrowserProcessor and the UI must
 * never offer, attempt, or silently fall back to the server pipeline.
 */
export const HOSTED_BROWSER_ONLY: boolean =
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
    ?.VITE_HOSTED_BROWSER_ONLY === 'true';
