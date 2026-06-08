import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionService } from '../billing/subscription.service';
import { RegisterDto, LoginDto } from './dto/index';
import Redis from 'ioredis';

const USER_AUTH_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  subscriptionStatus: true,
  subscriptionExpiresAt: true,
  plan: {
    select: {
      id: true,
      name: true,
      priceVnd: true,
      durationDays: true,
      maxAgents: true,
      description: true,
      isTrial: true,
    },
  },
} as const;

@Injectable()
export class AuthService {
  private redis: Redis;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private subscriptionService: SubscriptionService,
  ) {
    this.redis = new Redis({
      host: this.configService.get<string>('redis.host'),
      port: this.configService.get<number>('redis.port'),
      password: this.configService.get<string>('redis.password'),
    });
  }

  private async formatUser(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    subscriptionStatus?: SubscriptionStatus;
    subscriptionExpiresAt?: Date | null;
    plan?: {
      id: string;
      name: string;
      priceVnd: number;
      durationDays: number;
      maxAgents: number;
      description: string | null;
      isTrial: boolean;
    } | null;
  }) {
    const expiresAt = user.subscriptionExpiresAt ?? null;
    const status = user.subscriptionStatus ?? SubscriptionStatus.TRIAL;
    const plan = await this.subscriptionService.resolveEffectivePlan(
      user.id,
      status,
      user.plan ?? null,
    );
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      subscriptionStatus: status,
      subscriptionExpiresAt: expiresAt,
      daysLeft: this.subscriptionService.computeDaysLeft(expiresAt),
      plan,
    };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
      },
      select: USER_AUTH_SELECT,
    });

    await this.subscriptionService.startTrial(user.id);

    const refreshed = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: USER_AUTH_SELECT,
    });

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
    );
    return {
      user: await this.formatUser(refreshed ?? user),
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { ...USER_AUTH_SELECT, password: true },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const { password: _pw, ...safeUser } = user;
    const tokens = await this.generateTokens(user.id, user.email, user.role);
    return {
      user: await this.formatUser(safeUser),
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const isBlacklisted = await this.redis.get(`bl:${refreshToken}`);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: USER_AUTH_SELECT,
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or deactivated');
    }

    await this.redis.set(`bl:${refreshToken}`, '1', 'EX', 7 * 24 * 60 * 60);

    return this.generateTokens(user.id, user.email, user.role);
  }

  async logout(refreshToken: string) {
    await this.redis.set(`bl:${refreshToken}`, '1', 'EX', 7 * 24 * 60 * 60);
    return { message: 'Logged out successfully' };
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };
    const accessExp = this.configService.get<string>('jwt.accessExpiration') ?? '15m';
    const refreshExp = this.configService.get<string>('jwt.refreshExpiration') ?? '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.accessSecret'),
        expiresIn: accessExp as unknown as number,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: refreshExp as unknown as number,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async verifyRefreshToken(
    refreshToken: string,
  ): Promise<{ sub: string; email: string; role: string }> {
    try {
      return await this.jwtService.verifyAsync<{ sub: string; email: string; role: string }>(
        refreshToken,
        {
          secret: this.configService.get<string>('jwt.refreshSecret'),
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
