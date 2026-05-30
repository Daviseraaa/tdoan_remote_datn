import { Module, forwardRef } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { DesktopRecordingsController } from './desktop-recordings.controller';
import { DesktopRecordingsService } from './desktop-recordings.service';

@Module({
  imports: [forwardRef(() => AgentsModule)],
  controllers: [DesktopRecordingsController],
  providers: [DesktopRecordingsService],
  exports: [DesktopRecordingsService],
})
export class DesktopRecordingsModule {}
