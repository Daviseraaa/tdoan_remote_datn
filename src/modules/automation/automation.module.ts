import { Module, forwardRef } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { TriggersModule } from '../triggers/triggers.module';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { WorkflowRuntimeService } from './workflow-runtime.service';

@Module({
  imports: [TasksModule, forwardRef(() => TriggersModule)],
  controllers: [AutomationController],
  providers: [AutomationService, WorkflowRuntimeService],
  exports: [AutomationService, WorkflowRuntimeService],
})
export class AutomationModule {}
