import { apiFetch } from '@/src/lib/api';
import type {
  CheckoutResponse,
  PaymentRecord,
  PaymentStatusResponse,
  SubscriptionPlan,
  SubscriptionSnapshot,
  SubscriptionStatus,
} from '@/src/types/api';

export async function listPlans(): Promise<SubscriptionPlan[]> {
  return apiFetch<SubscriptionPlan[]>('/billing/plans', { skipAuth: true });
}

export async function getSubscription(): Promise<SubscriptionSnapshot> {
  return apiFetch<SubscriptionSnapshot>('/billing/subscription');
}

export async function createCheckout(planId: string): Promise<CheckoutResponse> {
  return apiFetch<CheckoutResponse>('/billing/checkout', {
    method: 'POST',
    body: { planId },
  });
}

export async function getPaymentCheckout(paymentId: string): Promise<CheckoutResponse> {
  return apiFetch<CheckoutResponse>(`/billing/payments/${paymentId}/checkout`);
}

export async function getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse> {
  return apiFetch<PaymentStatusResponse>(`/billing/payments/${paymentId}/status`);
}

export async function listPayments(limit = 20): Promise<PaymentRecord[]> {
  return apiFetch<PaymentRecord[]>(`/billing/payments?limit=${limit}`);
}

export async function adminSetSubscription(
  userId: string,
  body: {
    subscriptionExpiresAt?: string;
    subscriptionStatus?: SubscriptionStatus;
    planId?: string;
  },
) {
  return apiFetch(`/billing/users/${userId}/subscription`, {
    method: 'PATCH',
    body,
  });
}
