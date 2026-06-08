import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TASK_QUEUE } from '../../common/constants/index';
import { AgentsModule } from '../agents/agents.module';
import { BillingModule } from '../billing/billing.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TasksProcessor } from './tasks.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: TASK_QUEUE }),
    AgentsModule,
    BillingModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, TasksProcessor],
  exports: [TasksService],
})
export class TasksModule {}
