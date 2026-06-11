import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Role, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeTrialEmail } from './trial-email';

const PLAN_SELECT = {
  id: true,
  name: true,
  originalPriceVnd: true,
  priceVnd: true,
  durationDays: true,
  maxAgents: true,
  description: true,
  isTrial: true,
} as const;

export type SubscriptionPlanSummary = {
  id: string;
  name: string;
  originalPriceVnd: number;
  priceVnd: number;
  durationDays: number;
  maxAgents: number;
  description: string | null;
  isTrial: boolean;
};

export type SubscriptionSnapshot = {
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt: Date | null;
  daysLeft: number;
  isActive: boolean;
  plan: SubscriptionPlanSummary | null;
};

function paymentRequired(message: string): HttpException {
  return new HttpException(message, HttpStatus.PAYMENT_REQUIRED);
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(private prisma: PrismaService) {}

  async getTrialPlan() {
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { isTrial: true, isActive: true },
    });
    if (!plan) {
      throw new Error('Chưa cấu hình gói trial (isTrial=true)');
    }
    return plan;
  }

  async startTrial(userId: string, email?: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, trialUsedAt: true },
    });
    if (!user) {
      throw paymentRequired('Không tìm thấy tài khoản');
    }
    if (user.trialUsedAt) {
      throw paymentRequired('Tài khoản đã dùng gói dùng thử.');
    }

    const trialEmail = email?.trim() || user.email;
    await this.assertTrialEmailAvailable(trialEmail, userId);

    const plan = await this.getTrialPlan();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + plan.durationDays);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: SubscriptionStatus.TRIAL,
        subscriptionExpiresAt: expiresAt,
        trialUsedAt: new Date(),
        planId: plan.id,
      },
    });
  }

  /** Một email (sau chuẩn hóa) chỉ được trial một lần trên toàn hệ thống. */
  async assertTrialEmailAvailable(email: string, excludeUserId: string): Promise<void> {
    const fingerprint = normalizeTrialEmail(email);
    const prior = await this.prisma.user.findMany({
      where: {
        trialUsedAt: { not: null },
        NOT: { id: excludeUserId },
      },
      select: { email: true },
    });
    for (const row of prior) {
      if (normalizeTrialEmail(row.email) === fingerprint) {
        throw paymentRequired(
          'Email này đã được dùng cho gói dùng thử. Vui lòng gia hạn hoặc dùng email khác.',
        );
      }
    }
  }

  isSubscriptionActive(
    user: {
      role: Role;
      subscriptionStatus: SubscriptionStatus;
      subscriptionExpiresAt: Date | null;
    },
  ): boolean {
    if (user.role === Role.ADMIN) return true;
    if (!user.subscriptionExpiresAt) return false;
    if (user.subscriptionExpiresAt.getTime() <= Date.now()) return false;
    return (
      user.subscriptionStatus === SubscriptionStatus.TRIAL ||
      user.subscriptionStatus === SubscriptionStatus.ACTIVE
    );
  }

  computeDaysLeft(expiresAt: Date | null): number {
    if (!expiresAt) return 0;
    const ms = expiresAt.getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }

  async resolveEffectivePlan(
    userId: string,
    status: SubscriptionStatus,
    linkedPlan: SubscriptionPlanSummary | null,
  ): Promise<SubscriptionPlanSummary | null> {
    if (status !== SubscriptionStatus.TRIAL) {
      return linkedPlan;
    }

    const trialPlan = await this.getTrialPlan();
    const summary: SubscriptionPlanSummary = {
      id: trialPlan.id,
      name: trialPlan.name,
      originalPriceVnd: trialPlan.originalPriceVnd,
      priceVnd: trialPlan.priceVnd,
      durationDays: trialPlan.durationDays,
      maxAgents: trialPlan.maxAgents,
      description: trialPlan.description,
      isTrial: trialPlan.isTrial,
    };

    if (linkedPlan?.id !== trialPlan.id) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { planId: trialPlan.id },
      });
      this.logger.log(`Gán lại gói trial cho user ${userId}`);
    }

    return summary;
  }

  async getSnapshot(userId: string): Promise<SubscriptionSnapshot> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        plan: { select: PLAN_SELECT },
      },
    });
    if (!user) {
      throw paymentRequired('Không tìm thấy tài khoản');
    }

    const plan = await this.resolveEffectivePlan(
      user.id,
      user.subscriptionStatus,
      user.plan,
    );
    const isActive = this.isSubscriptionActive(user);
    return {
      subscriptionStatus: user.subscriptionStatus,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      daysLeft: this.computeDaysLeft(user.subscriptionExpiresAt),
      isActive,
      plan,
    };
  }

  async assertActive(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
      },
    });
    if (!user) {
      throw paymentRequired('Không tìm thấy tài khoản');
    }
    if (this.isSubscriptionActive(user)) return;

    if (
      user.subscriptionExpiresAt &&
      user.subscriptionExpiresAt.getTime() <= Date.now() &&
      user.subscriptionStatus !== SubscriptionStatus.EXPIRED
    ) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { subscriptionStatus: SubscriptionStatus.EXPIRED },
      });
    }

    throw paymentRequired(
      'Gói đăng ký đã hết hạn. Vui lòng gia hạn để tiếp tục sử dụng.',
    );
  }

  /**
   * Agent được phép connect nếu nằm trong `maxAgents` slot đầu tiên (theo createdAt).
   * `null` = admin — không giới hạn.
   */
  async getAllowedAgentIds(userId: string): Promise<Set<string> | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        subscriptionStatus: true,
        plan: { select: PLAN_SELECT },
      },
    });
    if (!user) return new Set();
    if (user.role === Role.ADMIN) return null;

    const plan = await this.resolveEffectivePlan(
      userId,
      user.subscriptionStatus,
      user.plan,
    );
    const maxAgents = plan?.maxAgents ?? 1;
    const agents = await this.prisma.agent.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: maxAgents,
      select: { id: true },
    });
    return new Set(agents.map((a) => a.id));
  }

  async assertAgentConnectAllowed(userId: string, agentId: string): Promise<void> {
    await this.assertActive(userId);
    const allowed = await this.getAllowedAgentIds(userId);
    if (allowed === null) return;
    if (!allowed.has(agentId)) {
      throw paymentRequired(
        'Agent này vượt giới hạn gói hiện tại. Nâng cấp gói hoặc xóa agent khác.',
      );
    }
  }

  async assertCanAddAgent(userId: string): Promise<void> {
    await this.assertActive(userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        plan: { select: { maxAgents: true } },
        _count: { select: { agents: true } },
      },
    });
    if (!user) {
      throw paymentRequired('Không tìm thấy tài khoản');
    }
    if (user.role === Role.ADMIN) return;

    const maxAgents = user.plan?.maxAgents ?? 1;
    if (user._count.agents >= maxAgents) {
      throw paymentRequired(
        `Đã đạt giới hạn ${maxAgents} agent cho gói hiện tại.`,
      );
    }
  }

  async extendSubscription(userId: string, planId: string): Promise<void> {
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { id: planId, isActive: true },
    });
    if (!plan) {
      throw new Error('Plan not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionExpiresAt: true },
    });
    if (!user) {
      throw new Error('User not found');
    }

    const base = user.subscriptionExpiresAt
      ? new Date(
          Math.max(user.subscriptionExpiresAt.getTime(), Date.now()),
        )
      : new Date();
    base.setDate(base.getDate() + plan.durationDays);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        subscriptionExpiresAt: base,
        planId: plan.id,
      },
    });
  }

  async adminSetSubscription(
    userId: string,
    data: {
      subscriptionExpiresAt?: Date;
      subscriptionStatus?: SubscriptionStatus;
      planId?: string;
    },
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        plan: { select: PLAN_SELECT },
      },
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async syncExpiredStatus(): Promise<void> {
    const now = new Date();
    const result = await this.prisma.user.updateMany({
      where: {
        role: Role.USER,
        subscriptionStatus: {
          in: [SubscriptionStatus.TRIAL, SubscriptionStatus.ACTIVE],
        },
        subscriptionExpiresAt: { lt: now },
      },
      data: { subscriptionStatus: SubscriptionStatus.EXPIRED },
    });
    if (result.count > 0) {
      this.logger.log(`Marked ${result.count} user(s) as EXPIRED`);
    }
  }
}
