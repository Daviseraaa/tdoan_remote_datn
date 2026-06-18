import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionService } from '../billing/subscription.service';
import { RegisterDto, LoginDto } from './dto/index';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../admin/audit.service';
import Redis from 'ioredis';
import { OAuth2Client } from 'google-auth-library';
import { randomBytes, randomInt } from 'crypto';

const REGISTER_OTP_KEY = (email: string) => `register:otp:${email}`;
const REGISTER_OTP_COOLDOWN_KEY = (email: string) =>
  `register:otp:cooldown:${email}`;
const REGISTER_OTP_ATTEMPTS_KEY = (email: string) =>
  `register:otp:attempts:${email}`;

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
      originalPriceVnd: true,
      priceVnd: true,
      durationDays: true,
      maxAgents: true,
      description: true,
      benefits: true,
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
    private mailService: MailService,
    private audit: AuditService,
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
      originalPriceVnd: number;
      priceVnd: number;
      durationDays: number;
      maxAgents: number;
      description: string | null;
      benefits: unknown;
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
      isSubscriptionActive: this.subscriptionService.isSubscriptionActive({
        role: user.role as Role,
        subscriptionStatus: status,
        subscriptionExpiresAt: expiresAt,
      }),
      plan,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private generateRegisterOtp(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  async sendRegisterOtp(email: string) {
    const normalized = this.normalizeEmail(email);
    const existing = await this.prisma.user.findUnique({
      where: { email: normalized },
    });
    if (existing) {
      throw new ConflictException('Email đã được đăng ký');
    }

    const cooldownSeconds =
      this.configService.get<number>('otp.registerCooldownSeconds') ?? 60;
    const cooldown = await this.redis.get(REGISTER_OTP_COOLDOWN_KEY(normalized));
    if (cooldown) {
      throw new BadRequestException(
        'Vui lòng đợi trước khi gửi lại mã OTP',
      );
    }

    const ttlSeconds =
      this.configService.get<number>('otp.registerTtlSeconds') ?? 600;
    const otp = this.generateRegisterOtp();

    await this.mailService.sendRegisterOtp(normalized, otp);

    await this.redis.set(REGISTER_OTP_KEY(normalized), otp, 'EX', ttlSeconds);
    await this.redis.set(
      REGISTER_OTP_COOLDOWN_KEY(normalized),
      '1',
      'EX',
      cooldownSeconds,
    );
    await this.redis.del(REGISTER_OTP_ATTEMPTS_KEY(normalized));

    return {
      message: 'Mã OTP đã được gửi đến email của bạn',
      expiresInSeconds: ttlSeconds,
      cooldownSeconds,
    };
  }

  private async assertRegisterOtpValid(email: string, otp: string) {
    const normalized = this.normalizeEmail(email);
    const ttlSeconds =
      this.configService.get<number>('otp.registerTtlSeconds') ?? 600;
    const maxAttempts =
      this.configService.get<number>('otp.registerMaxAttempts') ?? 5;

    const stored = await this.redis.get(REGISTER_OTP_KEY(normalized));
    if (!stored) {
      throw new BadRequestException(
        'Mã OTP đã hết hạn hoặc chưa được gửi. Vui lòng gửi lại mã.',
      );
    }

    const attemptsKey = REGISTER_OTP_ATTEMPTS_KEY(normalized);
    const attempts = parseInt((await this.redis.get(attemptsKey)) ?? '0', 10);
    if (attempts >= maxAttempts) {
      throw new BadRequestException(
        'Đã nhập sai quá nhiều lần. Vui lòng gửi lại mã OTP.',
      );
    }

    if (stored !== otp.trim()) {
      await this.redis.set(attemptsKey, String(attempts + 1), 'EX', ttlSeconds);
      throw new BadRequestException('Mã OTP không đúng');
    }

    await this.redis.del(REGISTER_OTP_KEY(normalized));
    await this.redis.del(attemptsKey);
  }

  async register(dto: RegisterDto) {
    const normalized = this.normalizeEmail(dto.email);
    await this.assertRegisterOtpValid(normalized, dto.otp);

    const existing = await this.prisma.user.findUnique({
      where: { email: normalized },
    });
    if (existing) {
      throw new ConflictException('Email đã được đăng ký');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: normalized,
        name: dto.name.trim(),
        password: hashedPassword,
      },
      select: USER_AUTH_SELECT,
    });

    await this.subscriptionService.startTrial(user.id, user.email);

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

  async loginWithGoogle(idToken: string, ip?: string) {
    const clientId = this.configService.get<string>('google.clientId');
    if (!clientId) {
      throw new BadRequestException('Đăng nhập Google chưa được cấu hình');
    }

    const client = new OAuth2Client(clientId);
    let payload: {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
    };
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });
      payload = ticket.getPayload() ?? {};
    } catch {
      await this.audit.record({
        action: 'auth.google.failed',
        resource: 'auth',
        metadata: { reason: 'invalid_token' },
        ip,
      });
      throw new UnauthorizedException('Token Google không hợp lệ');
    }

    const googleId = payload.sub;
    const email = payload.email ? this.normalizeEmail(payload.email) : '';
    if (!googleId || !email) {
      await this.audit.record({
        actorEmail: email || undefined,
        action: 'auth.google.failed',
        resource: 'auth',
        metadata: { reason: 'missing_profile' },
        ip,
      });
      throw new UnauthorizedException('Thiếu thông tin từ Google');
    }
    if (payload.email_verified === false) {
      await this.audit.record({
        actorEmail: email,
        action: 'auth.google.failed',
        resource: 'auth',
        metadata: { reason: 'email_unverified' },
        ip,
      });
      throw new UnauthorizedException('Email Google chưa được xác thực');
    }

    const displayName = payload.name?.trim() || email.split('@')[0] || 'User';

    let user = await this.prisma.user.findUnique({
      where: { googleId },
      select: USER_AUTH_SELECT,
    });

    if (!user) {
      const byEmail = await this.prisma.user.findUnique({
        where: { email },
        select: { ...USER_AUTH_SELECT, googleId: true },
      });

      if (byEmail) {
        if (byEmail.googleId && byEmail.googleId !== googleId) {
          throw new ConflictException('Email đã liên kết tài khoản Google khác');
        }
        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: {
            googleId,
            name: byEmail.name?.trim() ? byEmail.name : displayName,
          },
          select: USER_AUTH_SELECT,
        });
      } else {
        const hashedPassword = await bcrypt.hash(
          randomBytes(32).toString('hex'),
          10,
        );
        user = await this.prisma.user.create({
          data: {
            email,
            name: displayName,
            password: hashedPassword,
            googleId,
          },
          select: USER_AUTH_SELECT,
        });
        await this.subscriptionService.startTrial(user.id, user.email);
        user =
          (await this.prisma.user.findUnique({
            where: { id: user.id },
            select: USER_AUTH_SELECT,
          })) ?? user;
      }
    }

    if (!user.isActive) {
      await this.audit.record({
        actorId: user.id,
        actorEmail: user.email,
        action: 'auth.google.failed',
        resource: 'auth',
        resourceId: user.id,
        metadata: { reason: 'deactivated' },
        ip,
      });
      throw new UnauthorizedException('Tài khoản đã bị vô hiệu hóa');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.audit.record({
      actorId: user.id,
      actorEmail: user.email,
      action: 'auth.google.login',
      resource: 'auth',
      resourceId: user.id,
      ip,
    });
    return {
      user: await this.formatUser(user),
      ...tokens,
    };
  }

  buildGoogleRedirectSuccessUrl(tokens: {
    accessToken: string;
    refreshToken: string;
  }): string {
    const base =
      this.configService.get<string>('frontend.url') ?? 'http://localhost:5173';
    const url = new URL('/auth/google/callback', base);
    url.hash = new URLSearchParams({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    }).toString();
    return url.toString();
  }

  buildGoogleRedirectFailureUrl(): string {
    const base =
      this.configService.get<string>('frontend.url') ?? 'http://localhost:5173';
    const url = new URL('/login', base);
    url.searchParams.set('google_error', '1');
    return url.toString();
  }

  async completeGoogleRedirect(
    credential: string | undefined,
    ip?: string,
  ): Promise<string> {
    try {
      if (!credential?.trim()) {
        await this.audit.record({
          action: 'auth.google.failed',
          resource: 'auth',
          metadata: { reason: 'missing_credential' },
          ip,
        });
        return this.buildGoogleRedirectFailureUrl();
      }
      const result = await this.loginWithGoogle(credential, ip);
      return this.buildGoogleRedirectSuccessUrl({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    } catch {
      return this.buildGoogleRedirectFailureUrl();
    }
  }

  async login(dto: LoginDto, ip?: string) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { ...USER_AUTH_SELECT, password: true },
    });
    if (!user) {
      await this.audit.record({
        actorEmail: email,
        action: 'auth.login.failed',
        resource: 'auth',
        metadata: { reason: 'invalid_credentials' },
        ip,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      await this.audit.record({
        actorEmail: email,
        action: 'auth.login.failed',
        resource: 'auth',
        metadata: { reason: 'invalid_credentials' },
        ip,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      await this.audit.record({
        actorEmail: email,
        action: 'auth.login.failed',
        resource: 'auth',
        metadata: { reason: 'deactivated' },
        ip,
      });
      throw new UnauthorizedException('Account is deactivated');
    }

    const { password: _pw, ...safeUser } = user;
    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.audit.record({
      actorId: user.id,
      actorEmail: user.email,
      action: 'auth.login',
      resource: 'auth',
      resourceId: user.id,
      ip,
    });
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

  async logout(
    refreshToken: string,
    actor?: { id: string; email: string },
    ip?: string,
  ) {
    await this.redis.set(`bl:${refreshToken}`, '1', 'EX', 7 * 24 * 60 * 60);
    if (actor) {
      await this.audit.record({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'auth.logout',
        resource: 'auth',
        resourceId: actor.id,
        ip,
      });
    }
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
