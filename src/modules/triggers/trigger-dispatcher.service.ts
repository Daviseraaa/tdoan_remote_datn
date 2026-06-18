import { Injectable, Logger } from '@nestjs/common';
import {
  TriggerExecutionStatus,
  WorkflowTriggerType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionService } from '../billing/subscription.service';
import { WorkflowRuntimeService } from '../automation/workflow-runtime.service';
import {
  parseWorkflowVariables,
  applyTelegramVariableBindings,
} from '../automation/workflow-variables';
import { computeNextRunAt } from './schedule.util';
import type { TelegramMatchConfig } from './telegram/telegram.types';

export type TriggerDispatchPayload = Record<string, unknown>;

@Injectable()
export class TriggerDispatcherService {
  private readonly logger = new Logger(TriggerDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscription: SubscriptionService,
    private readonly workflowRuntime: WorkflowRuntimeService,
  ) {}

  /**
   * Fire workflow run — không await, mỗi trigger event = instance riêng.
   */
  dispatch(
    triggerId: string,
    userId: string,
    payload: TriggerDispatchPayload,
  ): void {
    void this.runTriggeredWorkflow(triggerId, userId, payload).catch((err) => {
      this.logger.error(`Trigger ${triggerId} dispatch failed`, err);
    });
  }

  private async runTriggeredWorkflow(
    triggerId: string,
    userId: string,
    payload: TriggerDispatchPayload,
  ) {
    try {
      await this.subscription.assertActive(userId);
    } catch {
      this.logger.warn(
        `Trigger ${triggerId} skipped: subscription inactive for user ${userId}`,
      );
      await this.prisma.triggerExecution.create({
        data: {
          triggerId,
          status: TriggerExecutionStatus.SKIPPED,
          error: 'Subscription expired',
          payload: payload as object,
          completedAt: new Date(),
        },
      });
      await this.prisma.workflowTrigger.update({
        where: { id: triggerId },
        data: { lastRunAt: new Date(), lastRunStatus: 'SKIPPED' },
      });
      return;
    }

    const trigger = await this.prisma.workflowTrigger.findFirst({
      where: { id: triggerId, userId, enabled: true },
      include: { workflow: true },
    });

    if (!trigger) {
      this.logger.warn(`Trigger ${triggerId} not found or disabled`);
      return;
    }
    if (!trigger.workflow?.isActive) {
      this.logger.warn(
        `Trigger ${triggerId}: workflow ${trigger.workflowId} is inactive — bật workflow (isActive)`,
      );
      return;
    }

    const execution = await this.prisma.triggerExecution.create({
      data: {
        triggerId,
        status: TriggerExecutionStatus.STARTED,
        payload: payload as object,
      },
    });

    try {
      const wfVars = parseWorkflowVariables(trigger.workflow.variables);
      const mc = (trigger.matchConfig ?? null) as TelegramMatchConfig | null;
      let mergedVars: Record<string, unknown> = { ...wfVars, ...payload };
      if (
        trigger.type === WorkflowTriggerType.TELEGRAM &&
        payload.telegram &&
        typeof payload.telegram === 'object'
      ) {
        mergedVars = applyTelegramVariableBindings(
          mergedVars,
          mc?.variableArgs,
          payload.telegram as Record<string, unknown>,
        );
      }

      const started = await this.workflowRuntime.startRunFromTrigger(
        trigger.workflowId,
        userId,
        {
          triggerId: trigger.id,
          triggerType: trigger.type,
          triggerPayload: payload,
          variables: mergedVars,
        },
      );

      await this.prisma.triggerExecution.update({
        where: { id: execution.id },
        data: {
          status: TriggerExecutionStatus.COMPLETED,
          workflowRunId: started.runId,
          completedAt: new Date(),
        },
      });

      const nextRunAt =
        trigger.type === WorkflowTriggerType.SCHEDULE
          ? computeNextRunAt(trigger, new Date())
          : trigger.nextRunAt;

      await this.prisma.workflowTrigger.update({
        where: { id: triggerId },
        data: {
          lastRunAt: new Date(),
          lastRunStatus: 'COMPLETED',
          lastWorkflowRunId: started.runId,
          ...(trigger.type === WorkflowTriggerType.SCHEDULE
            ? { nextRunAt }
            : {}),
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await this.prisma.triggerExecution.update({
        where: { id: execution.id },
        data: {
          status: TriggerExecutionStatus.FAILED,
          error: msg,
          completedAt: new Date(),
        },
      });
      await this.prisma.workflowTrigger.update({
        where: { id: triggerId },
        data: { lastRunAt: new Date(), lastRunStatus: 'FAILED' },
      });
      throw err;
    }
  }
}
