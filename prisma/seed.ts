import { PrismaClient, Role, SubscriptionStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const TRIAL_PLAN_ID = '00000000-0000-4000-a000-000000000000';
const TRIAL_PLAN = {
  name: 'Dùng thử',
  priceVnd: 0,
  durationDays: 7,
  maxAgents: 1,
  description: 'Gói dùng thử miễn phí khi đăng ký tài khoản',
  isActive: true,
  isTrial: true,
};

const DEFAULT_PLAN_ID = '00000000-0000-4000-a000-000000000001';
const DEFAULT_PLAN = {
  name: 'Gói tháng',
  priceVnd: 199_000,
  durationDays: 30,
  maxAgents: 3,
  description: 'Automation đầy đủ — tối đa 3 agent',
  isActive: true,
  isTrial: false,
};

async function main() {
  const trialPlan = await prisma.subscriptionPlan.upsert({
    where: { id: TRIAL_PLAN_ID },
    update: TRIAL_PLAN,
    create: {
      id: TRIAL_PLAN_ID,
      ...TRIAL_PLAN,
    },
  });

  const plan = await prisma.subscriptionPlan.upsert({
    where: { id: DEFAULT_PLAN_ID },
    update: DEFAULT_PLAN,
    create: {
      id: DEFAULT_PLAN_ID,
      ...DEFAULT_PLAN,
    },
  });

  // Migrate legacy seed id (non-UUID) nếu DB cũ còn bản ghi default-monthly-plan
  const legacy = await prisma.subscriptionPlan.findUnique({
    where: { id: 'default-monthly-plan' },
  });
  if (legacy && legacy.id !== plan.id) {
    await prisma.user.updateMany({
      where: { planId: legacy.id },
      data: { planId: plan.id },
    });
    await prisma.payment.updateMany({
      where: { planId: legacy.id },
      data: { planId: plan.id },
    });
    await prisma.subscriptionPlan.delete({ where: { id: legacy.id } });
  }

  const farFuture = new Date('2099-12-31T23:59:59.000Z');
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@stationhub.com' },
    update: {
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      subscriptionExpiresAt: farFuture,
      planId: plan.id,
    },
    create: {
      email: 'admin@stationhub.com',
      name: 'Admin',
      password: hashedPassword,
      role: Role.ADMIN,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      subscriptionExpiresAt: farFuture,
      planId: plan.id,
    },
  });

  const trialExpires = new Date();
  trialExpires.setDate(trialExpires.getDate() + trialPlan.durationDays);

  const user = await prisma.user.upsert({
    where: { email: 'user@stationhub.com' },
    update: {
      planId: trialPlan.id,
    },
    create: {
      email: 'user@stationhub.com',
      name: 'Demo User',
      password: await bcrypt.hash('user123', 10),
      role: Role.USER,
      subscriptionStatus: SubscriptionStatus.TRIAL,
      subscriptionExpiresAt: trialExpires,
      trialUsedAt: new Date(),
      planId: trialPlan.id,
    },
  });

  console.log('Seeded:', {
    trialPlan: trialPlan.name,
    plan: plan.name,
    admin: admin.email,
    user: user.email,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
