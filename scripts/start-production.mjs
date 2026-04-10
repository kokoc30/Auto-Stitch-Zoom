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

async function main() {
  const port = process.env.PORT || '3001';
  const host = process.env.HOST || '0.0.0.0';
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    HOST: host,
    PORT: port,
  };

  log('Building Auto Stitch & Zoom for a single-server local run...');
  await runCommand(['run', 'build'], env);

  log(`Starting production server on http://localhost:${port}`);
  log('This is the recommended mode for Cloudflare Tunnel sharing.');
  log(`Cloudflare Tunnel target: http://localhost:${port}`);
  log('Press Ctrl+C to stop the server.');

  await runCommand(['--prefix', 'server', 'run', 'start'], env);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[start:prod] ${message}`);
  process.exit(1);
});
