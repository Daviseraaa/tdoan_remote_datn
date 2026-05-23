import { Injectable } from '@nestjs/common';
import { WorkflowTriggerType } from '@prisma/client';

/** Plugin registry — thêm provider mới (Webhook, Slack, …) tại đây. */
export type TriggerPluginMeta = {
  type: WorkflowTriggerType | string;
  label: string;
  description: string;
};

@Injectable()
export class TriggerRegistryService {
  private readonly plugins: TriggerPluginMeta[] = [
    {
      type: WorkflowTriggerType.MANUAL,
      label: 'Manual',
      description: 'Chạy từ admin hoặc API execute',
    },
    {
      type: WorkflowTriggerType.SCHEDULE,
      label: 'Schedule',
      description: 'Cron, interval, daily, hourly, one-shot',
    },
    {
      type: WorkflowTriggerType.TELEGRAM,
      label: 'Telegram',
      description: 'Message, command, callback, file',
    },
    {
      type: 'WEBHOOK',
      label: 'Webhook (planned)',
      description: 'HTTP inbound event',
    },
    {
      type: 'DISCORD',
      label: 'Discord (planned)',
      description: 'Discord bot events',
    },
  ];

  listPlugins(): TriggerPluginMeta[] {
    return this.plugins;
  }
}
