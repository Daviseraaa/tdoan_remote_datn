import { config } from './config';
import { logger } from './logger';
import { ConnectionManager } from './core/connection-manager';
import { HeartbeatService } from './core/heartbeat';
import { TaskRunner } from './core/task-runner';
import { RemoteHost } from './remote/remote-host';

async function main() {
  logger.info(
    {
      serverUrl: config.serverUrl,
      hostname: config.hostname,
      platform: config.platform,
      agentVersion: config.agentVersion,
    },
    'DATN Agent starting',
  );

  const connection = new ConnectionManager();
  const heartbeat = new HeartbeatService(connection);
  const taskRunner = new TaskRunner(connection);
  new RemoteHost(connection);

  connection.on('connected', () => {
    try {
      taskRunner.register();
      heartbeat.start();
    } catch (err) {
      logger.error({ err }, 'Failed to register task runner');
    }
  });

  connection.on('disconnected', () => {
    heartbeat.stop();
  });

  connection.connect();

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    heartbeat.stop();
    connection.disconnect();
    setTimeout(() => process.exit(0), 500);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught exception');
  });
  process.on('unhandledRejection', (err) => {
    logger.error({ err }, 'Unhandled rejection');
  });
}

main().catch((err) => {
  logger.error({ err }, 'Fatal error on startup');
  process.exit(1);
});
