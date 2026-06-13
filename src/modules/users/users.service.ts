import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionService } from '../billing/subscription.service';
import type { SubscriptionPlanSummary } from '../billing/subscription.service';
import { UpdateUserDto, ChangePasswordDto } from './dto/index';
import { PaginationDto, PaginatedResponseDto } from '../../common/dto/pagination.dto';

export const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  subscriptionStatus: true,
  subscriptionExpiresAt: true,
  createdAt: true,
  updatedAt: true,
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
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private subscription: SubscriptionService,
  ) {}

  private async enrichUser<
    T extends {
      id: string;
      subscriptionExpiresAt?: Date | null;
      role: Role;
      subscriptionStatus: SubscriptionStatus;
      plan?: SubscriptionPlanSummary | null;
    },
  >(user: T) {
    const plan = await this.subscription.resolveEffectivePlan(
      user.id,
      user.subscriptionStatus,
      user.plan ?? null,
    );
    return {
      ...user,
      plan,
      daysLeft: this.subscription.computeDaysLeft(
        user.subscriptionExpiresAt ?? null,
      ),
      isSubscriptionActive: this.subscription.isSubscriptionActive({
        role: user.role,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiresAt: user.subscriptionExpiresAt ?? null,
      }),
    };
  }

  async findAll(pagination: PaginationDto) {
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        select: USER_SELECT,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);
    const items = await Promise.all(users.map((u) => this.enrichUser(u)));
    return new PaginatedResponseDto(items, total, pagination);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return this.enrichUser(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: USER_SELECT,
    });
    return this.enrichUser(user);
  }

  async changePassword(id: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const isValid = await bcrypt.compare(dto.oldPassword, user.password);
    if (!isValid) throw new UnauthorizedException('Invalid old password');

    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id },
      data: { password: hashed },
    });

    return { message: 'Password changed successfully' };
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted successfully' };
  }

  async toggleActive(id: string) {
    const user = await this.findOne(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: USER_SELECT,
    });
    return this.enrichUser(updated);
  }
}
