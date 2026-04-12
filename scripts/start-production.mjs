import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function log(message) {
  process.stdout.write(`${message}\n`);
}

function runCommand(args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(npmCommand, args, {
      cwd: rootDir,
      env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`Command stopped by signal ${signal}`));
        return;
      }

      if ((code ?? 0) !== 0) {
        reject(new Error(`Command exited with code ${code ?? 1}`));
        return;
      }

      resolve();
    });
  });
}

function parsePort(raw) {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    return null;
  }
  return parsed;
}

async function main() {
  if (process.env.HOSTED_BROWSER_ONLY === 'true') {
    console.error(
      '[start:prod] Refusing to start: HOSTED_BROWSER_ONLY=true is set.\n' +
        '             This runner is for the FULL local-share profile where\n' +
        '             server-side processing runs on this machine. The hosted\n' +
        '             browser-only profile is for Render Free and disables\n' +
        '             server processing — the two modes are mutually exclusive.\n' +
        '             Unset HOSTED_BROWSER_ONLY (and VITE_HOSTED_BROWSER_ONLY)\n' +
        '             and try again, or deploy via the Render path in\n' +
        '             docs/deployment.md instead.'
    );
    process.exit(1);
  }

  const port = parsePort(process.env.PORT) ?? 3001;
  const host = process.env.HOST || '0.0.0.0';
  const publicBaseUrl =
    process.env.PUBLIC_BASE_URL || process.env.APP_ORIGIN || '';
  const accessGateEnabled = (process.env.SHARE_ACCESS_PASSWORD ?? '') !== '';

  const env = {
    ...process.env,
    NODE_ENV: 'production',
    HOST: host,
    PORT: String(port),
  };

  log('Building Auto Stitch & Zoom for a single-server local run...');
  await runCommand(['run', 'build'], env);

  const localUrl = `http://localhost:${port}`;
  const bannerLines = [
    '',
    '================================================================',
    ' Auto Stitch & Zoom — local share mode (full profile)',
    '================================================================',
    ` Local URL:          ${localUrl}`,
    ` Health check:       ${localUrl}/health`,
    ` Bind:               ${host}:${port}`,
    ' Processing modes:   Browser + Server + Auto (all enabled)',
    '                     Server jobs run on THIS machine.',
  ];
  if (publicBaseUrl) {
    bannerLines.push(` Public URL (hint):  ${publicBaseUrl}`);
    bannerLines.push(`                     ${publicBaseUrl}/health`);
  } else {
    bannerLines.push(
      ' Public URL:         (none set — export PUBLIC_BASE_URL to echo it here)'
    );
  }
  if (accessGateEnabled) {
    bannerLines.push(
      ' Access gate:        ENABLED — visitors must enter SHARE_ACCESS_PASSWORD',
      '                     Share the password out-of-band with trusted users.'
    );
  } else {
    bannerLines.push(
      ' Access gate:        disabled (set SHARE_ACCESS_PASSWORD to enable)'
    );
  }
  bannerLines.push(
    ' To expose publicly: in a second terminal run one of:',
    '   npm run tunnel:ngrok',
    '   npm run tunnel:cloudflared',
    ' Share the tunnel URL with TRUSTED users only. See docs/local-share.md.',
    ' Press Ctrl+C to stop the server.',
    '================================================================',
    ''
  );
  for (const line of bannerLines) {
    log(line);
  }

  await runCommand(['--prefix', 'server', 'run', 'start'], env);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[start:prod] ${message}`);
  process.exit(1);
});
