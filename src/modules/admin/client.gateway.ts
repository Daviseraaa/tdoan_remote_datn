import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { Role } from '@prisma/client';

interface ClientSocket extends Socket {
  data: {
    userId?: string;
    role?: Role;
    email?: string;
  };
}

@WebSocketGateway({
  namespace: '/ws/client',
  cors: { origin: '*' },
})
export class ClientGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ClientGateway.name);

  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async handleConnection(client: ClientSocket) {
    try {
      const token =
        client.handshake?.auth?.token ||
        client.handshake?.query?.token ||
        client.handshake?.headers?.authorization?.replace('Bearer ', '');

      if (!token || typeof token !== 'string') {
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
        role: Role;
      }>(token, {
        secret: this.config.get<string>('jwt.accessSecret'),
      });

      client.data = {
        userId: payload.sub,
        role: payload.role,
        email: payload.email,
      };

      client.join(`user:${payload.sub}`);
      if (payload.role === Role.ADMIN) {
        client.join('admins');
      }

      this.logger.log(
        `Client connected: ${payload.email} (${payload.role})`,
      );
    } catch (err) {
      this.logger.warn(
        `Client auth failed: ${(err as Error).message}`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: ClientSocket) {
    if (client.data?.email) {
      this.logger.log(`Client disconnected: ${client.data.email}`);
    }
  }

  notifyUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  notifyAdmins(event: string, data: unknown) {
    this.server.to('admins').emit(event, data);
  }
}
