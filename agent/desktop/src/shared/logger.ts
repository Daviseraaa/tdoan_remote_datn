import pino from 'pino';
import { loadDesktopConfig } from './config';

let _logger: pino.Logger | null = null;

export function getLogger(): pino.Logger {
  if (!_logger) {
    const cfg = loadDesktopConfig();
    _logger = pino({
      level: cfg.logLevel,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    });
  }
  return _logger;
}
