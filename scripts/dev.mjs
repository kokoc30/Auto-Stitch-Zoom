import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const colors = {
  server: '\x1b[36m',
  client: '\x1b[35m',
  reset: '\x1b[0m',
};

const children = [];
let shuttingDown = false;
let exitCode = 0;

function log(message) {
  process.stdout.write(`${message}\n`);
}

function prefixStream(stream, label, color) {
  const rl = readline.createInterface({ input: stream });
  rl.on('line', (line) => {
    log(`${color}[${label}]${colors.reset} ${line}`);
  });
}

function terminateChild(child) {
  if (!child.pid) return;

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    return;
  }

  child.kill('SIGTERM');
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  exitCode = code;

  for (const child of children) {
    terminateChild(child);
  }

  setTimeout(() => {
    process.exit(exitCode);
  }, 250);
}

function spawnRunner(label, scriptName, color) {
  const command = process.platform === 'win32' ? `${npmCommand} run ${scriptName}` : npmCommand;
  const args = process.platform === 'win32' ? [] : ['run', scriptName];

  const child = spawn(command, args, {
    cwd: rootDir,
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
    windowsHide: false,
    shell: process.platform === 'win32',
  });

  children.push(child);
  prefixStream(child.stdout, label, color);
  prefixStream(child.stderr, label, color);

  child.on('error', (error) => {
    log(`${color}[${label}]${colors.reset} Failed to start: ${error.message}`);
    shutdown(1);
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (signal) {
      log(`${color}[${label}]${colors.reset} Stopped by signal ${signal}.`);
      shutdown(1);
      return;
    }

    if ((code ?? 0) !== 0) {
      log(`${color}[${label}]${colors.reset} Exited with code ${code}.`);
      shutdown(code ?? 1);
      return;
    }

    log(`${color}[${label}]${colors.reset} Exited cleanly.`);
    shutdown(0);
  });
}

log('Starting Auto Stitch & Zoom from the project root...');
log('Backend: http://localhost:3001');
log('Frontend: Vite will print the local URL when it is ready (usually http://localhost:5173).');
log('Press Ctrl+C to stop both processes.');

spawnRunner('server', 'dev:server', colors.server);
spawnRunner('client', 'dev:client', colors.client);

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
