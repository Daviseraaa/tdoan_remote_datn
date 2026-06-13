import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SepayService, SepayWebhookPayload } from './sepay.service';
import { SubscriptionService } from './subscription.service';

const PENDING_TTL_HOURS = 24;

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private sepay: SepayService,
    private subscription: SubscriptionService,
  ) {}

  listActivePlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true, isTrial: false },
      orderBy: { priceVnd: 'asc' },
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
    });
  }

  getSubscription(userId: string) {
    return this.subscription.getSnapshot(userId);
  }

  async createCheckout(userId: string, planId: string) {
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { id: planId, isActive: true, isTrial: false },
    });
    if (!plan) {
      throw new NotFoundException('Gói đăng ký không tồn tại hoặc không thể mua');
    }
    if (plan.priceVnd <= 0) {
      throw new BadRequestException('Gói này không hỗ trợ thanh toán');
    }

    const orderCode = this.sepay.generateOrderCode();
    const paymentCode = this.sepay.generatePaymentCode();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + PENDING_TTL_HOURS);

    const bank = this.sepay.getBankInstructions(paymentCode, plan.priceVnd);

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        planId: plan.id,
        amountVnd: plan.priceVnd,
        orderCode: BigInt(orderCode),
        paymentCode,
        provider: 'SEPAY',
        status: PaymentStatus.PENDING,
        expiresAt,
      },
    });

    return {
      paymentId: payment.id,
      orderCode: orderCode.toString(),
      planName: plan.name,
      expiresAt: expiresAt.toISOString(),
      ...bank,
      webhookHint: this.sepay.webhookUrl(),
    };
  }

  async getPaymentStatus(userId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, userId },
      select: {
        id: true,
        status: true,
        paymentCode: true,
        amountVnd: true,
        paidAt: true,
        expiresAt: true,
      },
    });
    if (!payment) {
      throw new NotFoundException('Không tìm thấy giao dịch');
    }
    return payment;
  }

  listPayments(userId: string, limit = 20) {
    return this.prisma.payment
      .findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          amountVnd: true,
          status: true,
          orderCode: true,
          paymentCode: true,
          paidAt: true,
          createdAt: true,
          plan: { select: { name: true, durationDays: true } },
        },
      })
      .then((rows) =>
        rows.map((row) => ({
          ...row,
          orderCode: row.orderCode.toString(),
        })),
      );
  }

  async handleSepayWebhook(
    payload: SepayWebhookPayload,
    authorization: string | undefined,
    rawBody: string,
    signature: string | undefined,
    timestamp: string | undefined,
  ) {
    this.sepay.verifyWebhookAuth(authorization, rawBody, signature, timestamp);

    if (!this.sepay.isIncomingTransfer(payload)) {
      return { ok: true, skipped: true };
    }

    if (!this.sepay.validateAccountNumber(payload)) {
      return { ok: true, skipped: true, reason: 'wrong_account' };
    }

    const sepayId = String(payload.id);

    const existingTx = await this.prisma.payment.findUnique({
      where: { sepayTransactionId: sepayId },
    });
    if (existingTx?.status === PaymentStatus.PAID) {
      return { ok: true, duplicate: true };
    }

    const pending = await this.prisma.payment.findMany({
      where: { status: PaymentStatus.PENDING },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const payment = pending.find((p) =>
      this.sepay.matchesPaymentCode(payload, p.paymentCode),
    );

    if (!payment) {
      return { ok: true, skipped: true, reason: 'no_matching_payment' };
    }

    if (payload.transferAmount < payment.amountVnd) {
      return { ok: true, skipped: true, reason: 'insufficient_amount' };
    }

    if (payment.status === PaymentStatus.PAID) {
      return { ok: true, duplicate: true };
    }

    if (payment.expiresAt && payment.expiresAt.getTime() < Date.now()) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.EXPIRED },
      });
      return { ok: true, skipped: true, reason: 'payment_expired' };
    }

    await this.markPaymentPaid(payment.id, sepayId, payload);
    return { ok: true };
  }

  private async markPaymentPaid(
    paymentId: string,
    sepayTransactionId: string,
    payload: SepayWebhookPayload,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { plan: true },
      });
      if (!payment || payment.status === PaymentStatus.PAID) return;

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PAID,
          paidAt: new Date(),
          sepayTransactionId,
          metadata: payload as unknown as Prisma.InputJsonValue,
        },
      });

      const user = await tx.user.findUnique({
        where: { id: payment.userId },
        select: { subscriptionExpiresAt: true },
      });
      if (!user) return;

      const base = user.subscriptionExpiresAt
        ? new Date(Math.max(user.subscriptionExpiresAt.getTime(), Date.now()))
        : new Date();
      base.setDate(base.getDate() + payment.plan.durationDays);

      await tx.user.update({
        where: { id: payment.userId },
        data: {
          subscriptionStatus: 'ACTIVE',
          subscriptionExpiresAt: base,
          planId: payment.planId,
        },
      });
    });
  }

  adminSetSubscription(
    userId: string,
    dto: {
      subscriptionExpiresAt?: string;
      subscriptionStatus?: import('@prisma/client').SubscriptionStatus;
      planId?: string;
    },
  ) {
    const data: {
      subscriptionExpiresAt?: Date;
      subscriptionStatus?: import('@prisma/client').SubscriptionStatus;
      planId?: string;
    } = {};

    if (dto.subscriptionExpiresAt) {
      data.subscriptionExpiresAt = new Date(dto.subscriptionExpiresAt);
    }
    if (dto.subscriptionStatus) {
      data.subscriptionStatus = dto.subscriptionStatus;
    }
    if (dto.planId) {
      data.planId = dto.planId;
    }

    return this.subscription.adminSetSubscription(userId, data);
  }
}
