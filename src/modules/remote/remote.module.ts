import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AgentsModule } from '../agents/agents.module';
import { AdminModule } from '../admin/admin.module';
import { RemoteService } from './remote.service';
import { RemoteGateway } from './remote.gateway';
import { RemoteController } from './remote.controller';

@Module({
  imports: [JwtModule.register({}), AgentsModule, AdminModule],
  controllers: [RemoteController],
  providers: [RemoteService, RemoteGateway],
  exports: [RemoteService],
})
export class RemoteModule {}
