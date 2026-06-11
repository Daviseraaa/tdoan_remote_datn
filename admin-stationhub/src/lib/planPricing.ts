import type { SubscriptionPlan } from '@/src/types/api';

export function formatVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
}

export function planOriginalPrice(plan: Pick<SubscriptionPlan, 'originalPriceVnd' | 'priceVnd'>): number {
  return plan.originalPriceVnd ?? plan.priceVnd;
}

/** Có hiển thị giá gốc gạch ngang + % giảm. */
export function planHasDiscount(
  plan: Pick<SubscriptionPlan, 'originalPriceVnd' | 'priceVnd' | 'isTrial'>,
): boolean {
  if (plan.isTrial || plan.priceVnd <= 0) return false;
  return planOriginalPrice(plan) > plan.priceVnd;
}

export function planDiscountPercent(
  plan: Pick<SubscriptionPlan, 'originalPriceVnd' | 'priceVnd'>,
): number | null {
  if (!planHasDiscount(plan)) return null;
  const original = planOriginalPrice(plan);
  return Math.round((1 - plan.priceVnd / original) * 100);
}
