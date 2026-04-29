import * as os from 'os';
import { logger } from '../logger';
import { ConnectionManager } from './connection-manager';
import {
  TaskExecutePayload,
  TaskResultPayload,
  WS_EVENTS,
} from '../types';
import { executeCommand } from './command-executor';

export class TaskRunner {
  constructor(private readonly connection: ConnectionManager) {}

  private readonly onTaskExecute = (payload: TaskExecutePayload) => {
    this.run(payload).catch((err) => {
      logger.error({ err, taskId: payload?.taskId }, 'Task run crashed');
    });
  };

  register() {
    const socket = this.connection.currentSocket;
    if (!socket) {
      throw new Error('Connection not established');
    }

    // Prevent duplicate handlers after reconnect/re-register.
    socket.off(WS_EVENTS.TASK_EXECUTE, this.onTaskExecute);
    socket.on(WS_EVENTS.TASK_EXECUTE, this.onTaskExecute);
  }

  private async run(payload: TaskExecutePayload) {
    if (!payload || !payload.taskId) {
      logger.warn({ payload }, 'Invalid task payload');
      return;
    }

    const startedAt = Date.now();
    logger.info({ taskId: payload.taskId, type: payload.type }, 'Running task');

    try {
      const result = await this.executeByType(payload);
      const resultPayload: TaskResultPayload = {
        taskId: payload.taskId,
        status: result.status,
        result: result.output,
        exitCode: result.exitCode,
        startedAt,
        completedAt: Date.now(),
      };
      this.connection.emit_(WS_EVENTS.TASK_RESULT, resultPayload);
      logger.info(
        { taskId: payload.taskId, status: result.status, exitCode: result.exitCode },
        'Task finished',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const resultPayload: TaskResultPayload = {
        taskId: payload.taskId,
        status: 'FAILED',
        result: `[EXECUTION_ERROR] ${message}`,
        exitCode: -1,
        startedAt,
        completedAt: Date.now(),
      };
      this.connection.emit_(WS_EVENTS.TASK_RESULT, resultPayload);
      logger.error({ err, taskId: payload.taskId }, 'Task failed');
    }
  }

  private async executeByType(payload: TaskExecutePayload): Promise<{
    status: 'COMPLETED' | 'FAILED';
    output: string;
    exitCode: number;
  }> {
    switch (payload.type) {
      case 'SYSTEM_INFO': {
        return {
          status: 'COMPLETED',
          exitCode: 0,
          output: JSON.stringify(this.collectSystemInfo(), null, 2),
        };
      }
      case 'COMMAND':
      case 'SCRIPT': {
        const res = await executeCommand(payload.command, {
          timeoutMs: payload.timeout,
        });
        const combined = [
          res.stdout,
          res.stderr ? `\n[STDERR]\n${res.stderr}` : '',
          res.timedOut ? '\n[TIMEOUT]' : '',
        ].join('');
        return {
          status: res.exitCode === 0 && !res.timedOut ? 'COMPLETED' : 'FAILED',
          exitCode: res.exitCode,
          output: combined,
        };
      }
      case 'FILE_OPERATION': {
        return {
          status: 'FAILED',
          exitCode: -1,
          output: 'FILE_OPERATION not implemented in MVP',
        };
      }
      default:
        return {
          status: 'FAILED',
          exitCode: -1,
          output: `Unknown task type: ${payload.type}`,
        };
    }
  }

  private collectSystemInfo() {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
      loadavg: os.loadavg(),
      networkInterfaces: Object.keys(os.networkInterfaces()),
      userInfo: os.userInfo().username,
    };
  }
}
