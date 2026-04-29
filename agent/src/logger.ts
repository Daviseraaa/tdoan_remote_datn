import pino from 'pino';
import { config } from './config';
import { createPinoTelegramHook } from './telegram-log';

export const logger = pino({
  level: config.logLevel,
  hooks: {
    logMethod: createPinoTelegramHook('agent'),
  },
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:HH:MM:ss',
      ignore: 'pid,hostname',
    },
  },
});
