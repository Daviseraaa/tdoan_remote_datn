import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient();
    const agentKey =
      client.handshake?.auth?.agentKey || client.handshake?.query?.agentKey;

    if (!agentKey) {
      throw new WsException('Missing agentKey');
    }

    const agent = await this.prisma.agent.findUnique({
      where: { agentKey },
    });

    if (!agent) {
      throw new WsException('Invalid agentKey');
    }

    client.data = { agent };
    return true;
  }
}
