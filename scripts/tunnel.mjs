import { spawn } from 'node:child_process';
import process from 'node:process';

const PROVIDERS = {
  ngrok: (port) => ({
    bin: 'ngrok',
    args: ['http', String(port)],
  }),
  cloudflared: (port) => ({
    bin: 'cloudflared',
    args: ['tunnel', '--url', `http://localhost:${port}`],
  }),
};

function fail(message, code = 1) {
  console.error(`[tunnel] ${message}`);
  process.exit(code);
}

function parsePort(raw) {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    return null;
  }
  return parsed;
}

function main() {
  const providerName = process.argv[2];
  if (!providerName || !(providerName in PROVIDERS)) {
    const supported = Object.keys(PROVIDERS).join(', ');
    fail(
      `Unknown or missing provider: "${providerName ?? ''}". ` +
        `Supported: ${supported}. Example: node ./scripts/tunnel.mjs ngrok`
    );
  }

  const rawPort = process.env.PORT ?? '3001';
  const port = parsePort(rawPort);
  if (port === null) {
    fail(
      `PORT is not a valid port number: "${rawPort}". ` +
        `Expected an integer between 1 and 65535.`
    );
  }

  const { bin, args } = PROVIDERS[providerName](port);
  const target = `http://localhost:${port}`;

  console.log(`[tunnel] Provider: ${providerName}`);
  console.log(`[tunnel] Forwarding ${providerName} -> ${target}`);
  console.log(`[tunnel] Spawning: ${bin} ${args.join(' ')}`);

  const child = spawn(bin, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  child.on('error', (error) => {
    if (error && error.code === 'ENOENT') {
      fail(
        `Could not find "${bin}" on PATH. Install it first:\n` +
          `  ngrok:       https://ngrok.com/download (then run "ngrok config add-authtoken <token>")\n` +
          `  cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/`
      );
    }
    fail(`Failed to start ${bin}: ${error.message}`);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`[tunnel] ${bin} stopped by signal ${signal}`);
      process.exit(1);
    }
    process.exit(code ?? 0);
  });
}

main();
