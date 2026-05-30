import { Module, forwardRef } from '@nestjs/common';
import { ChromeScriptsModule } from '../chrome-scripts/chrome-scripts.module';
import { DesktopRecordingsModule } from '../desktop-recordings/desktop-recordings.module';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { AgentsGateway } from './agents.gateway';
import { AgentTelemetryStore } from './agent-telemetry.store';

@Module({
  imports: [
    forwardRef(() => ChromeScriptsModule),
    forwardRef(() => DesktopRecordingsModule),
  ],
  controllers: [AgentsController],
  providers: [AgentsService, AgentsGateway, AgentTelemetryStore],
  exports: [AgentsService, AgentsGateway, AgentTelemetryStore],
})
export class AgentsModule {}
