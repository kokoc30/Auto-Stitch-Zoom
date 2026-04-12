import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';
const npmCommand = isWin ? 'npm.cmd' : 'npm';

function log(message) {
  process.stdout.write(`[share] ${message}\n`);
}

function errLog(message) {
  process.stderr.write(`[share] ${message}\n`);
}

function parsePort(raw) {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    return null;
  }
  return parsed;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, { timeoutMs = 1500 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function pingHealth(port, { timeoutMs = 1500 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  if (isWin) {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
      });
    } catch {
      // best-effort
    }
    return;
  }
  try {
    child.kill('SIGTERM');
    setTimeout(() => {
      if (child.exitCode === null) {
        try {
          child.kill('SIGKILL');
        } catch {
          // best-effort
        }
      }
    }, 5000).unref();
  } catch {
    // best-effort
  }
}

async function waitForHealth(port, child, { totalMs = 180_000, intervalMs = 500 }) {
  const deadline = Date.now() + totalMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `server (share:local) exited early with code ${child.exitCode} before becoming healthy`
      );
    }
    if (await pingHealth(port)) return;
    await sleep(intervalMs);
  }
  throw new Error(
    `server did not become healthy on http://127.0.0.1:${port}/health within ${Math.round(
      totalMs / 1000
    )}s`
  );
}

async function waitForNgrokUrl(child, { totalMs = 20_000, intervalMs = 500 }) {
  const deadline = Date.now() + totalMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        'ngrok exited before reporting a tunnel. Common causes: ' +
          'missing auth token (run "ngrok config add-authtoken <token>"), ' +
          'or another ngrok session is already running on this account.'
      );
    }
    const body = await fetchJson('http://127.0.0.1:4040/api/tunnels');
    if (body && Array.isArray(body.tunnels)) {
      const https = body.tunnels.find(
        (t) => typeof t.public_url === 'string' && t.public_url.startsWith('https://')
      );
      if (https) return https.public_url;
      const any = body.tunnels.find((t) => typeof t.public_url === 'string');
      if (any) return any.public_url;
    }
    await sleep(intervalMs);
  }
  throw new Error(
    'ngrok started but no HTTPS tunnel URL was found via http://127.0.0.1:4040/api/tunnels. ' +
      'Is another ngrok session already running on this account?'
  );
}

function copyToClipboardWindows(text) {
  if (!isWin) return;
  try {
    const proc = spawn('clip', [], { stdio: ['pipe', 'ignore', 'ignore'], shell: true });
    proc.stdin.end(text);
  } catch {
    // best-effort
  }
}

function printBanner({ port, publicUrl, accessGateEnabled }) {
  const localUrl = `http://localhost:${port}`;
  const lines = [
    '',
    '================================================================',
    ' Auto Stitch & Zoom — PUBLIC SHARE via ngrok',
    '================================================================',
    ` Local URL:          ${localUrl}`,
    ` Health (local):     ${localUrl}/health`,
    ` Public URL:         ${publicUrl}`,
    ` Health (public):    ${publicUrl}/health`,
    ` Access gate:        ${accessGateEnabled ? 'ENABLED (SHARE_ACCESS_PASSWORD set)' : 'disabled (set SHARE_ACCESS_PASSWORD to enable)'}`,
    ' Mode:               full local-share profile',
    ' Share with TRUSTED users only. Ctrl+C stops the server and the tunnel.',
    '================================================================',
    '',
  ];
  for (const line of lines) {
    process.stdout.write(`${line}\n`);
  }
}

async function main() {
  const providerName = process.argv[2] ?? 'ngrok';
  if (providerName !== 'ngrok') {
    errLog(
      `Only "ngrok" is supported by this orchestrator. Got: "${providerName}". ` +
        'For cloudflared, use "npm run tunnel:cloudflared" in a second terminal alongside "npm run share:local".'
    );
    process.exit(2);
  }

  const port = parsePort(process.env.PORT) ?? 3001;
  const accessGateEnabled = (process.env.SHARE_ACCESS_PASSWORD ?? '') !== '';

  let serverChild = null;
  let ngrokChild = null;
  let shuttingDown = false;

  const shutdown = (code) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log('Shutting down tunnel and server...');
    killTree(ngrokChild);
    killTree(serverChild);
    setTimeout(() => process.exit(code), 500).unref();
  };

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));

  log(`Starting full local-share profile on port ${port} (npm run share:local)...`);
  serverChild = spawn(npmCommand, ['run', 'share:local'], {
    cwd: rootDir,
    env: { ...process.env, PORT: String(port) },
    stdio: 'inherit',
    shell: isWin,
  });

  serverChild.on('error', (err) => {
    errLog(`Failed to start share:local: ${err.message}`);
    shutdown(1);
  });
  serverChild.on('exit', (code, signal) => {
    if (shuttingDown) return;
    errLog(
      `share:local exited unexpectedly (code=${code ?? 'null'}, signal=${signal ?? 'null'}).`
    );
    shutdown(code ?? 1);
  });

  try {
    log(`Waiting for http://127.0.0.1:${port}/health ...`);
    await waitForHealth(port, serverChild, { totalMs: 180_000, intervalMs: 500 });
    log('Server is healthy.');
  } catch (err) {
    errLog(err instanceof Error ? err.message : String(err));
    shutdown(1);
    return;
  }

  log('Launching ngrok...');
  ngrokChild = spawn('ngrok', ['http', String(port)], {
    cwd: rootDir,
    env: process.env,
    stdio: 'ignore',
    shell: isWin,
  });

  let ngrokSpawnFailed = false;
  ngrokChild.on('error', (err) => {
    ngrokSpawnFailed = true;
    if (err && err.code === 'ENOENT') {
      errLog(
        'Could not find "ngrok" on PATH. Install it first: https://ngrok.com/download ' +
          '(then run "ngrok config add-authtoken <token>").'
      );
    } else {
      errLog(`Failed to start ngrok: ${err.message}`);
    }
    shutdown(1);
  });
  ngrokChild.on('exit', (code, signal) => {
    if (shuttingDown) return;
    errLog(`ngrok exited unexpectedly (code=${code ?? 'null'}, signal=${signal ?? 'null'}).`);
    shutdown(code ?? 1);
  });

  try {
    const publicUrl = await waitForNgrokUrl(ngrokChild, {
      totalMs: 20_000,
      intervalMs: 500,
    });
    if (ngrokSpawnFailed) return;
    printBanner({ port, publicUrl, accessGateEnabled });
    copyToClipboardWindows(publicUrl);
    if (isWin) log('Public URL copied to clipboard.');
  } catch (err) {
    errLog(err instanceof Error ? err.message : String(err));
    shutdown(1);
    return;
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  errLog(message);
  process.exit(1);
});
