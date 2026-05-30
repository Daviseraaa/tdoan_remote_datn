import { Injectable, Logger } from '@nestjs/common';
import {
  StepRunStatus,
  StepType,
  WorkflowRunStatus,
  WorkflowTriggerType,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { TelegramApiService } from './telegram-api.service';
import type { TelegramTriggerPayload } from './telegram.types';

type StepLike = {
  id: string;
  order: number;
  type: StepType;
  config: unknown;
};

type RunProgressState = {
  botToken: string;
  chatId: string;
  messageId: number;
  workflowName: string;
  steps: StepLike[];
  /** stepId → status */
  stepStatus: Map<string, 'pending' | 'running' | 'completed' | 'failed' | 'skipped'>;
  runStatus: WorkflowRunStatus | 'RUNNING';
  error?: string;
  flushTimer?: ReturnType<typeof setTimeout>;
};

function parseConfig(raw: unknown): { title?: string; stepKey?: string } {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as { title?: string; stepKey?: string };
  }
  return {};
}

const STEP_TYPE_VI: Partial<Record<StepType, string>> = {
  [StepType.COMMAND]: 'Lệnh',
  [StepType.SCRIPT]: 'Script',
  [StepType.DELAY]: 'Chờ',
  [StepType.CONDITION]: 'Điều kiện',
  [StepType.TELEGRAM]: 'Telegram',
};

@Injectable()
export class TelegramWorkflowProgressService {
  private readonly logger = new Logger(TelegramWorkflowProgressService.name);
  private readonly runs = new Map<string, RunProgressState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly api: TelegramApiService,
  ) {}

  /** Bật khi workflow chạy từ trigger TELEGRAM. */
  async registerRun(opts: {
    runId: string;
    userId: string;
    workflowName: string;
    steps: StepLike[];
    triggerId: string | null;
    triggerPayload: unknown;
  }): Promise<void> {
    const tg = this.extractTelegramPayload(opts.triggerPayload);
    if (!tg?.chatId) return;

    const botToken = await this.resolveBotToken(opts.userId, opts.triggerId);
    if (!botToken) {
      this.logger.warn(`Telegram progress: no bot token run=${opts.runId}`);
      return;
    }

    const stepStatus = new Map<
      string,
      'pending' | 'running' | 'completed' | 'failed' | 'skipped'
    >();
    for (const s of opts.steps) {
      stepStatus.set(s.id, 'pending');
    }

    const text = this.formatMessage({
      workflowName: opts.workflowName,
      steps: opts.steps,
      stepStatus,
      runStatus: WorkflowRunStatus.RUNNING,
    });

    try {
      const res = await this.api.sendMessage(botToken, {
        chat_id: tg.chatId,
        text,
        parse_mode: 'HTML',
        reply_to_message_id: tg.messageId ? Number(tg.messageId) : undefined,
      });

      this.runs.set(opts.runId, {
        botToken,
        chatId: tg.chatId,
        messageId: res.message_id,
        workflowName: opts.workflowName,
        steps: opts.steps,
        stepStatus,
        runStatus: WorkflowRunStatus.RUNNING,
      });
    } catch (err) {
      this.logger.warn(
        `Telegram progress init failed run=${opts.runId}`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  onStepStart(runId: string, stepId: string) {
    const state = this.runs.get(runId);
    if (!state) return;
    state.stepStatus.set(stepId, 'running');
    this.scheduleFlush(runId);
  }

  onStepEnd(
    runId: string,
    stepId: string,
    status: StepRunStatus,
  ) {
    const state = this.runs.get(runId);
    if (!state) return;
    if (status === StepRunStatus.FAILED) {
      state.stepStatus.set(stepId, 'failed');
    } else if (status === StepRunStatus.SKIPPED) {
      state.stepStatus.set(stepId, 'skipped');
    } else {
      state.stepStatus.set(stepId, 'completed');
    }
    this.scheduleFlush(runId);
  }

  async finalize(
    runId: string,
    status: WorkflowRunStatus,
    error?: string,
  ): Promise<void> {
    const state = this.runs.get(runId);
    if (!state) return;

    if (state.flushTimer) {
      clearTimeout(state.flushTimer);
      state.flushTimer = undefined;
    }

    state.runStatus = status;
    state.error = error;

    await this.flush(runId, true);
    this.runs.delete(runId);
  }

  private scheduleFlush(runId: string) {
    const state = this.runs.get(runId);
    if (!state) return;
    if (state.flushTimer) clearTimeout(state.flushTimer);
    state.flushTimer = setTimeout(() => {
      state.flushTimer = undefined;
      void this.flush(runId, false);
    }, 400);
  }

  private async flush(runId: string, force: boolean) {
    const state = this.runs.get(runId);
    if (!state) return;

    const text = this.formatMessage({
      workflowName: state.workflowName,
      steps: state.steps,
      stepStatus: state.stepStatus,
      runStatus: state.runStatus,
      error: state.error,
    });

    try {
      await this.api.editMessageText(state.botToken, {
        chat_id: state.chatId,
        message_id: state.messageId,
        text,
        parse_mode: 'HTML',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!force && msg.toLowerCase().includes('message is not modified')) return;
      this.logger.debug(`Telegram progress edit run=${runId}: ${msg}`);
    }
  }

  private formatMessage(opts: {
    workflowName: string;
    steps: StepLike[];
    stepStatus: Map<string, 'pending' | 'running' | 'completed' | 'failed' | 'skipped'>;
    runStatus: WorkflowRunStatus | 'RUNNING';
    error?: string;
  }): string {
    const sorted = [...opts.steps].sort((a, b) => a.order - b.order);
    const running = sorted.filter((s) => opts.stepStatus.get(s.id) === 'running');
    const lines: string[] = [
      `<b>📋 Workflow:</b> ${this.escapeHtml(opts.workflowName)}`,
      '',
      this.runStatusLine(opts.runStatus, running.length, opts.error),
      '',
      '<b>Các bước:</b>',
    ];

    for (const step of sorted) {
      const st = opts.stepStatus.get(step.id) ?? 'pending';
      lines.push(`${this.stepIcon(st)} ${this.escapeHtml(this.stepLabel(step))}`);
    }

    if (running.length > 0) {
      lines.push('');
      lines.push(
        `<b>▶ Đang chạy:</b> ${running.map((s) => this.escapeHtml(this.stepLabel(s))).join(', ')}`,
      );
    }

    return lines.join('\n');
  }

  private runStatusLine(
    status: WorkflowRunStatus | 'RUNNING',
    runningCount: number,
    error?: string,
  ): string {
    if (status === WorkflowRunStatus.COMPLETED) {
      return '✅ <b>Hoàn thành</b>';
    }
    if (status === WorkflowRunStatus.FAILED) {
      const err = error ? `\n❗ ${this.escapeHtml(error.slice(0, 200))}` : '';
      return `❌ <b>Thất bại</b>${err}`;
    }
    if (runningCount > 0) {
      return `🔄 <b>Đang chạy</b> (${runningCount} bước song song)`;
    }
    return '⏳ <b>Đang khởi động…</b>';
  }

  private stepIcon(
    st: 'pending' | 'running' | 'completed' | 'failed' | 'skipped',
  ): string {
    switch (st) {
      case 'running':
        return '🔄';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      case 'skipped':
        return '⏭';
      default:
        return '⏳';
    }
  }

  private stepLabel(step: StepLike): string {
    const cfg = parseConfig(step.config);
    if (cfg.title?.trim()) return cfg.title.trim();
    const typeName = STEP_TYPE_VI[step.type] ?? step.type;
    return `Bước ${step.order} — ${typeName}`;
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private extractTelegramPayload(
    raw: unknown,
  ): TelegramTriggerPayload | null {
    if (!raw || typeof raw !== 'object') return null;
    const root = raw as Record<string, unknown>;
    const tg = root.telegram;
    if (!tg || typeof tg !== 'object') return null;
    const p = tg as Record<string, unknown>;
    if (!p.chatId) return null;
    return {
      chatId: String(p.chatId),
      userId: String(p.userId ?? ''),
      messageId: p.messageId != null ? String(p.messageId) : undefined,
      timestamp: String(p.timestamp ?? ''),
      event: String(p.event ?? 'message'),
      updateId: Number(p.updateId ?? 0),
    };
  }

  private async resolveBotToken(
    userId: string,
    triggerId: string | null,
  ): Promise<string | null> {
    if (!triggerId) return null;
    const trigger = await this.prisma.workflowTrigger.findFirst({
      where: { id: triggerId, userId, type: WorkflowTriggerType.TELEGRAM },
      include: { telegramBot: { select: { botToken: true, enabled: true } } },
    });
    if (!trigger?.telegramBot?.enabled) return null;
    return trigger.telegramBot.botToken;
  }
}
