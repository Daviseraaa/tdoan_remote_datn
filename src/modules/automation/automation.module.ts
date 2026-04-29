import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';

@Module({
  imports: [TasksModule],
  controllers: [AutomationController],
  providers: [AutomationService],
})
export class AutomationModule {}
