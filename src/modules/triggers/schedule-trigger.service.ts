import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScheduleKind, WorkflowTriggerType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TriggerDispatcherService } from './trigger-dispatcher.service';
import { computeNextRunAt } from './schedule.util';

@Injectable()
export class ScheduleTriggerService implements OnModuleInit {
  private readonly logger = new Logger(ScheduleTriggerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: TriggerDispatcherService,
  ) {}

  async onModuleInit() {
    await this.refreshAllNextRunTimes();
    await this.migrateLegacyCronTriggers();
    this.logger.log('Schedule trigger engine initialized');
  }

  /** Migrate workflow.cronExpression → WorkflowTrigger SCHEDULE */
  private async migrateLegacyCronTriggers() {
    const workflows = await this.prisma.workflow.findMany({
      where: {
        cronExpression: { not: null },
        triggers: { none: { type: WorkflowTriggerType.SCHEDULE } },
      },
      select: {
        id: true,
        userId: true,
        name: true,
        cronExpression: true,
        isActive: true,
      },
    });

    for (const wf of workflows) {
      if (!wf.cronExpression?.trim()) continue;
      const nextRunAt = computeNextRunAt({
        scheduleKind: 'CRON' as never,
        cronExpression: wf.cronExpression,
        timezone: 'Asia/Ho_Chi_Minh',
      });
      await this.prisma.workflowTrigger.create({
        data: {
          userId: wf.userId,
          workflowId: wf.id,
          type: WorkflowTriggerType.SCHEDULE,
          name: `Cron: ${wf.name}`,
          enabled: wf.isActive,
          scheduleKind: ScheduleKind.CRON,
          cronExpression: wf.cronExpression,
          nextRunAt,
        },
      });
    }
  }

  async refreshAllNextRunTimes() {
    const triggers = await this.prisma.workflowTrigger.findMany({
      where: {
        type: WorkflowTriggerType.SCHEDULE,
        enabled: true,
      },
    });
    for (const t of triggers) {
      const next = computeNextRunAt(t);
      await this.prisma.workflowTrigger.update({
        where: { id: t.id },
        data: { nextRunAt: next },
      });
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    const now = new Date();
    const due = await this.prisma.workflowTrigger.findMany({
      where: {
        type: WorkflowTriggerType.SCHEDULE,
        enabled: true,
        nextRunAt: { lte: now },
      },
      include: { workflow: { select: { isActive: true } } },
    });

    for (const trigger of due) {
      if (!trigger.workflow.isActive) continue;
      this.dispatcher.dispatch(trigger.id, trigger.userId, {
        schedule: {
          triggerId: trigger.id,
          firedAt: now.toISOString(),
          kind: trigger.scheduleKind,
        },
      });
    }
  }
}
