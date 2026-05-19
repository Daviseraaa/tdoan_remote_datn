import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { AgentsGateway } from './agents.gateway';
import { AgentTelemetryStore } from './agent-telemetry.store';

@Module({
  controllers: [AgentsController],
  providers: [AgentsService, AgentsGateway, AgentTelemetryStore],
  exports: [AgentsService, AgentsGateway, AgentTelemetryStore],
})
export class AgentsModule {}
