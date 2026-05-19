import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TasksModule } from '../tasks/tasks.module';
import { AgentsModule } from '../agents/agents.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuditService } from './audit.service';
import { ClientGateway } from './client.gateway';

@Module({
  imports: [JwtModule.register({}), TasksModule, AgentsModule],
  controllers: [AdminController],
  providers: [AdminService, AuditService, ClientGateway],
  exports: [AuditService, ClientGateway],
})
export class AdminModule {}
