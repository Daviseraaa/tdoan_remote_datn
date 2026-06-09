import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
  }));
});

describe('AuthService.refresh', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
  };
  const jwt = {
    verifyAsync: jest.fn(),
    signAsync: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string) => {
      const map: Record<string, string> = {
        'jwt.refreshSecret': 'refresh-secret',
        'jwt.accessSecret': 'access-secret',
        'jwt.accessExpiration': '15m',
        'jwt.refreshExpiration': '7d',
      };
      return map[key];
    }),
  };

  let service: AuthService;
  const subscriptionService = {
    computeDaysLeft: jest.fn(() => 7),
    startTrial: jest.fn().mockResolvedValue(undefined),
    resolveEffectivePlan: jest.fn(async (_id: string, _status: string, plan: unknown) => plan),
  };
  const mailService = {
    sendRegisterOtp: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      prisma as never,
      jwt as never as JwtService,
      config as never as ConfigService,
      subscriptionService as never,
      mailService as never,
    );
  });

  it('verifies refresh token signature before issuing new tokens', async () => {
    const redisGet = (service as unknown as { redis: { get: jest.Mock } }).redis.get;
    const redisSet = (service as unknown as { redis: { set: jest.Mock } }).redis.set;

    redisGet.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'admin@stationhub.com',
      role: Role.ADMIN,
      isActive: true,
      subscriptionStatus: 'ACTIVE',
      subscriptionExpiresAt: new Date('2099-01-01'),
      plan: null,
    });
    jwt.verifyAsync.mockResolvedValue({ sub: 'u1', email: 'admin@stationhub.com', role: Role.ADMIN });
    jwt.signAsync.mockResolvedValueOnce('access-token').mockResolvedValueOnce('refresh-token');

    const result = await service.refresh('valid-refresh-token');

    expect(jwt.verifyAsync).toHaveBeenCalledWith('valid-refresh-token', {
      secret: 'refresh-secret',
    });
    expect(redisSet).toHaveBeenCalled();
    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('throws UnauthorizedException when refresh token signature is invalid', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('invalid token'));

    await expect(service.refresh('tampered-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
