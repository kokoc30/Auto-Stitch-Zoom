/**
 * Copies the ffmpeg.wasm core runtime assets from node_modules into the
 * client's public directory so Vite bundles them as same-origin static files.
 *
 * Why: In production the Express server sets COOP/COEP isolation headers.
 * With COEP: require-corp, cross-origin fetches (e.g. to unpkg) are blocked
 * unless the remote sends a matching Cross-Origin-Resource-Policy header,
 * which unpkg does not reliably do. Self-hosting the core assets makes them
 * same-origin and avoids the issue entirely. It also removes a runtime CDN
 * dependency, which is a reliability win.
 *
 * Both the `esm/` and `umd/` distributions are copied. @ffmpeg/ffmpeg@0.12.x
 * spawns its internal worker with `type: "module"`, so `importScripts` is
 * unavailable and the worker falls back to dynamic `import()` of the core
 * script. That fallback requires the **ESM** build — dynamic-importing the
 * UMD build as an ES module fails with "failed to import ffmpeg-core.js".
 * We therefore point `browser-processor.ts` at `/ffmpeg/esm/ffmpeg-core.js`.
 *
 * Runs as the client's `prebuild` script, so the assets are ready before
 * `vite build` copies everything in public/ to dist/.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const CORE_DIST_DIR = path.join(
  rootDir,
  'client',
  'node_modules',
  '@ffmpeg',
  'core',
  'dist',
);
const DEST_DIR = path.join(rootDir, 'client', 'public', 'ffmpeg');

const SUBDIRS = ['esm', 'umd'];

function log(message) {
  process.stdout.write(`[copy-ffmpeg-core] ${message}\n`);
}

function fail(message) {
  process.stderr.write(`[copy-ffmpeg-core] ${message}\n`);
  process.exit(1);
}

if (!existsSync(CORE_DIST_DIR)) {
  fail(
    `Source directory not found: ${CORE_DIST_DIR}\n` +
      `  Run \`npm --prefix client install\` first so @ffmpeg/core is available.`,
  );
}

mkdirSync(DEST_DIR, { recursive: true });

let totalCopied = 0;

for (const sub of SUBDIRS) {
  const srcDir = path.join(CORE_DIST_DIR, sub);
  if (!existsSync(srcDir)) {
    fail(`Expected source subdirectory missing: ${srcDir}`);
  }

  const destSubDir = path.join(DEST_DIR, sub);
  mkdirSync(destSubDir, { recursive: true });

  const entries = readdirSync(srcDir);
  if (entries.length === 0) {
    fail(`Source directory is empty: ${srcDir}`);
  }

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry);
    const destPath = path.join(destSubDir, entry);

    const stat = statSync(srcPath);
    if (!stat.isFile()) continue;

    copyFileSync(srcPath, destPath);
    const sizeKb = Math.round(stat.size / 1024);
    log(`copied ${sub}/${entry} (${sizeKb} KB)`);
    totalCopied++;
  }
}

if (totalCopied === 0) {
  fail(`No files were copied from ${CORE_DIST_DIR}.`);
}

log(`Done. ${totalCopied} file(s) copied to ${DEST_DIR}.`);
