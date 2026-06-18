import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TasksModule } from '../tasks/tasks.module';
import { AgentsModule } from '../agents/agents.module';
import { BillingModule } from '../billing/billing.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ClientGateway } from './client.gateway';

@Module({
  imports: [JwtModule.register({}), TasksModule, AgentsModule, BillingModule],
  controllers: [AdminController],
  providers: [AdminService, ClientGateway],
  exports: [ClientGateway],
})
export class AdminModule {}
