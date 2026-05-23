import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ScheduleKind,
  WorkflowTriggerType,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { computeNextRunAt } from './schedule.util';
import { CreateTelegramBotDto, CreateWorkflowTriggerDto } from './dto/create-trigger.dto';
import { TelegramApiService } from './telegram/telegram-api.service';

@Injectable()
export class TriggersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly telegramApi: TelegramApiService,
  ) {}

  /** Telegram chỉ chấp nhận webhook HTTPS, không localhost. */
  private assertWebhookBaseUrl(): string {
    const base = this.config.get<string>('telegram.webhookBaseUrl')?.trim();
    if (!base) {
      throw new BadRequestException(
        'Chưa cấu hình PUBLIC_API_BASE_URL (vd. https://xxx.ngrok-free.app/api)',
      );
    }
    let parsed: URL;
    try {
      parsed = new URL(base);
    } catch {
      throw new BadRequestException('PUBLIC_API_BASE_URL không hợp lệ');
    }
    if (parsed.protocol !== 'https:') {
      throw new BadRequestException(
        'Webhook Telegram bắt buộc HTTPS. Đặt PUBLIC_API_BASE_URL=https://<tunnel-hoặc-domain>/api — không dùng http://localhost',
      );
    }
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      throw new BadRequestException(
        'Telegram không gọi được webhook localhost. Dùng ngrok/cloudflared: PUBLIC_API_BASE_URL=https://<tunnel>/api',
      );
    }
    return base.replace(/\/$/, '');
  }

  private buildWebhookUrl(base: string, botId: string, secret: string): string {
    return `${base}/webhooks/telegram/${botId}/${secret}`;
  }

  async listTriggers(userId: string, workflowId?: string) {
    return this.prisma.workflowTrigger.findMany({
      where: {
        userId,
        ...(workflowId ? { workflowId } : {}),
      },
      include: {
        workflow: { select: { id: true, name: true, isActive: true } },
        telegramBot: { select: { id: true, name: true, botUsername: true } },
        executions: {
          orderBy: { startedAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async listAllForUser(userId: string) {
    return this.listTriggers(userId);
  }

  async createTrigger(userId: string, dto: CreateWorkflowTriggerDto) {
    const wf = await this.prisma.workflow.findFirst({
      where: { id: dto.workflowId, userId },
    });
    if (!wf) throw new NotFoundException('Workflow not found');

    if (dto.type === WorkflowTriggerType.TELEGRAM && !dto.telegramBotId) {
      throw new BadRequestException('telegramBotId required for TELEGRAM trigger');
    }

    if (dto.type === WorkflowTriggerType.SCHEDULE && !dto.scheduleKind) {
      throw new BadRequestException('scheduleKind required for SCHEDULE trigger');
    }

    const nextRunAt =
      dto.type === WorkflowTriggerType.SCHEDULE
        ? computeNextRunAt({
            scheduleKind: dto.scheduleKind!,
            cronExpression: dto.cronExpression,
            intervalSeconds: dto.intervalSeconds,
            runAt: dto.runAt ? new Date(dto.runAt) : null,
            dailyHour: dto.dailyHour,
            dailyMinute: dto.dailyMinute,
            timezone: dto.timezone ?? 'Asia/Ho_Chi_Minh',
          })
        : null;

    return this.prisma.workflowTrigger.create({
      data: {
        userId,
        workflowId: dto.workflowId,
        type: dto.type,
        name: dto.name,
        enabled: dto.enabled ?? true,
        timezone: dto.timezone ?? 'Asia/Ho_Chi_Minh',
        scheduleKind: dto.scheduleKind,
        cronExpression: dto.cronExpression,
        intervalSeconds: dto.intervalSeconds,
        runAt: dto.runAt ? new Date(dto.runAt) : undefined,
        dailyHour: dto.dailyHour,
        dailyMinute: dto.dailyMinute,
        nextRunAt,
        telegramBotId: dto.telegramBotId,
        matchConfig: dto.matchConfig as object | undefined,
      },
      include: {
        workflow: { select: { id: true, name: true } },
        telegramBot: true,
      },
    });
  }

  async updateTrigger(
    userId: string,
    id: string,
    patch: Partial<CreateWorkflowTriggerDto>,
  ) {
    const existing = await this.prisma.workflowTrigger.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Trigger not found');

    const merged = { ...existing, ...patch };
    const runAtForSchedule =
      merged.runAt != null ? new Date(merged.runAt as string | Date) : null;
    const nextRunAt =
      existing.type === WorkflowTriggerType.SCHEDULE
        ? computeNextRunAt({
            scheduleKind: merged.scheduleKind,
            cronExpression: merged.cronExpression,
            intervalSeconds: merged.intervalSeconds,
            runAt: runAtForSchedule,
            dailyHour: merged.dailyHour,
            dailyMinute: merged.dailyMinute,
            timezone: merged.timezone,
          })
        : existing.nextRunAt;

    return this.prisma.workflowTrigger.update({
      where: { id },
      data: {
        name: patch.name,
        enabled: patch.enabled,
        timezone: patch.timezone,
        scheduleKind: patch.scheduleKind,
        cronExpression: patch.cronExpression,
        intervalSeconds: patch.intervalSeconds,
        runAt: patch.runAt ? new Date(patch.runAt) : undefined,
        dailyHour: patch.dailyHour,
        dailyMinute: patch.dailyMinute,
        nextRunAt,
        telegramBotId: patch.telegramBotId,
        matchConfig: patch.matchConfig as object | undefined,
      },
    });
  }

  async deleteTrigger(userId: string, id: string) {
    await this.findTrigger(userId, id);
    await this.prisma.workflowTrigger.delete({ where: { id } });
    return { message: 'Trigger deleted' };
  }

  async findTrigger(userId: string, id: string) {
    const t = await this.prisma.workflowTrigger.findFirst({
      where: { id, userId },
      include: {
        workflow: true,
        telegramBot: true,
        executions: { orderBy: { startedAt: 'desc' }, take: 20 },
      },
    });
    if (!t) throw new NotFoundException('Trigger not found');
    return t;
  }

  async listBots(userId: string) {
    return this.prisma.telegramBot.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createBot(userId: string, dto: CreateTelegramBotDto) {
    const base = this.assertWebhookBaseUrl();

    const me = await this.telegramApi.getMe(dto.botToken);
    const secret = randomBytes(24).toString('hex');

    const bot = await this.prisma.telegramBot.create({
      data: {
        userId,
        name: dto.name,
        botToken: dto.botToken,
        botUsername: me.username,
        mode: 'webhook',
        webhookSecret: secret,
        enabled: true,
      },
    });

    const webhookUrl = this.buildWebhookUrl(base, bot.id, secret);
    try {
      await this.telegramApi.setWebhook(dto.botToken, webhookUrl, secret);
    } catch (err) {
      await this.prisma.telegramBot.delete({ where: { id: bot.id } }).catch(() => undefined);
      const detail = err instanceof Error ? err.message : 'setWebhook failed';
      throw new BadRequestException(
        `Không đăng ký webhook với Telegram: ${detail}`,
      );
    }

    return { ...bot, webhookUrl };
  }

  async deleteBot(userId: string, id: string) {
    const bot = await this.prisma.telegramBot.findFirst({
      where: { id, userId },
    });
    if (!bot) throw new NotFoundException('Bot not found');
    await this.telegramApi.deleteWebhook(bot.botToken).catch(() => undefined);
    await this.prisma.telegramBot.delete({ where: { id } });
    return { message: 'Bot deleted' };
  }
}
