import './env.js';
import app from './app.js';
import { runStartupPreflight } from './services/runtime.service.js';
import { logger } from './utils/logger.js';

const DEFAULT_PORT = 3001;
const HOST = process.env.HOST || '0.0.0.0';
const parsedPort = Number.parseInt(process.env.PORT ?? '', 10);
const PORT = Number.isFinite(parsedPort) ? parsedPort : DEFAULT_PORT;

async function startServer(): Promise<void> {
  await runStartupPreflight();

  app.listen(PORT, HOST, () => {
    logger.info('server', 'Server started', { host: HOST, port: PORT });
  });
}

startServer().catch((error) => {
  logger.error('server', 'Server failed to start', { error });
  process.exit(1);
});
