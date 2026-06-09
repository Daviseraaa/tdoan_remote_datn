import { Module, forwardRef } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { ChromeScriptsModule } from '../chrome-scripts/chrome-scripts.module';
import { DesktopRecordingsModule } from '../desktop-recordings/desktop-recordings.module';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { AgentsGateway } from './agents.gateway';
import { AgentTelemetryStore } from './agent-telemetry.store';
import { WolService } from './wol.service';

@Module({
  imports: [
    BillingModule,
    forwardRef(() => ChromeScriptsModule),
    forwardRef(() => DesktopRecordingsModule),
  ],
  controllers: [AgentsController],
  providers: [AgentsService, AgentsGateway, AgentTelemetryStore, WolService],
  exports: [AgentsService, AgentsGateway, AgentTelemetryStore, WolService],
})
export class AgentsModule {}
