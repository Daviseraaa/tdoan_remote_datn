import {
  Sparkles,
  Crown,
  Award,
  Gem,
  Leaf,
  type LucideIcon,
} from 'lucide-react';
import type { SubscriptionPlan } from '@/src/types/api';
import type { TranslationKey } from '@/src/i18n/t';

export type PlanTierId = 'emerald' | 'amethyst' | 'gold' | 'platinum' | 'diamond';

const PLAN_TIER_ORDER: PlanTierId[] = ['emerald', 'amethyst', 'gold', 'platinum', 'diamond'];

export type PlanTierStyle = {
  labelKey: TranslationKey;
  Icon: LucideIcon;
  card: string;
  orb: string;
  orbSecondary: string;
  border: string;
  price: string;
  title: string;
  tierBadge: string;
  tierBadgeText: string;
  checkBg: string;
  checkIcon: string;
  button: string;
  hoverLift: string;
  ringActive: string;
  shimmer?: boolean;
  diamondGlow?: boolean;
};

export const PLAN_TIER_STYLES: Record<PlanTierId, PlanTierStyle> = {
  emerald: {
    labelKey: 'billing.planTierEmerald',
    Icon: Leaf,
    card: 'bg-gradient-to-br from-emerald-950/70 via-[#0b1326]/95 to-emerald-900/25',
    orb: 'bg-emerald-400/25',
    orbSecondary: 'bg-teal-500/15',
    border: 'border-emerald-500/25',
    price: 'text-emerald-300',
    title: 'text-emerald-100',
    tierBadge: 'bg-emerald-500/15 border-emerald-400/30',
    tierBadgeText: 'text-emerald-200',
    checkBg: 'bg-emerald-500/20',
    checkIcon: 'text-emerald-300',
    button:
      'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-600/25',
    hoverLift: 'hover:-translate-y-1 hover:shadow-[0_12px_40px_-16px_rgba(52,211,153,0.45)]',
    ringActive: '#34d399',
  },
  amethyst: {
    labelKey: 'billing.planTierAmethyst',
    Icon: Sparkles,
    card: 'bg-gradient-to-br from-violet-950/70 via-[#0b1326]/95 to-fuchsia-900/20',
    orb: 'bg-violet-400/25',
    orbSecondary: 'bg-purple-500/15',
    border: 'border-violet-500/30',
    price: 'text-violet-300',
    title: 'text-violet-100',
    tierBadge: 'bg-violet-500/15 border-violet-400/35',
    tierBadgeText: 'text-violet-200',
    checkBg: 'bg-violet-500/20',
    checkIcon: 'text-violet-300',
    button:
      'bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-lg shadow-violet-600/30',
    hoverLift: 'hover:-translate-y-1 hover:shadow-[0_12px_40px_-16px_rgba(167,139,250,0.5)]',
    ringActive: '#a78bfa',
  },
  gold: {
    labelKey: 'billing.planTierGold',
    Icon: Crown,
    card: 'bg-gradient-to-br from-amber-950/60 via-[#0b1326]/95 to-orange-900/25',
    orb: 'bg-amber-400/30',
    orbSecondary: 'bg-yellow-600/15',
    border: 'border-amber-400/35',
    price: 'text-amber-300',
    title: 'text-amber-50',
    tierBadge: 'bg-amber-500/15 border-amber-400/40',
    tierBadgeText: 'text-amber-100',
    checkBg: 'bg-amber-500/20',
    checkIcon: 'text-amber-300',
    button:
      'bg-gradient-to-r from-amber-600 to-yellow-500 text-amber-950 shadow-lg shadow-amber-500/30',
    hoverLift: 'hover:-translate-y-1 hover:shadow-[0_14px_44px_-14px_rgba(251,191,36,0.55)]',
    ringActive: '#fbbf24',
    shimmer: true,
  },
  platinum: {
    labelKey: 'billing.planTierPlatinum',
    Icon: Award,
    card: 'bg-gradient-to-br from-slate-400/10 via-[#0b1326]/95 to-sky-900/20',
    orb: 'bg-slate-300/20',
    orbSecondary: 'bg-sky-300/12',
    border: 'border-slate-300/25',
    price: 'text-slate-200',
    title: 'text-slate-50',
    tierBadge: 'bg-slate-400/10 border-slate-300/30',
    tierBadgeText: 'text-slate-100',
    checkBg: 'bg-slate-400/15',
    checkIcon: 'text-slate-200',
    button:
      'bg-gradient-to-r from-slate-300 to-slate-100 text-slate-900 shadow-lg shadow-slate-400/20',
    hoverLift: 'hover:-translate-y-1 hover:shadow-[0_14px_44px_-14px_rgba(226,232,240,0.35)]',
    ringActive: '#e2e8f0',
    shimmer: true,
  },
  diamond: {
    labelKey: 'billing.planTierDiamond',
    Icon: Gem,
    card: 'bg-gradient-to-br from-cyan-950/50 via-[#0b1326]/90 to-blue-900/30',
    orb: 'bg-cyan-300/30',
    orbSecondary: 'bg-sky-400/20',
    border: 'border-cyan-300/40',
    price: 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-white to-sky-300',
    title: 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-100 via-white to-sky-200',
    tierBadge: 'bg-cyan-400/15 border-cyan-300/45',
    tierBadgeText: 'text-cyan-100',
    checkBg: 'bg-cyan-400/20',
    checkIcon: 'text-cyan-200',
    button:
      'bg-gradient-to-r from-cyan-400 via-sky-300 to-cyan-200 text-slate-900 shadow-lg shadow-cyan-400/35',
    hoverLift:
      'hover:lg:scale-[1.02] hover:lg:-translate-y-1 hover:shadow-[0_20px_50px_-12px_rgba(103,232,249,0.55)]',
    ringActive: '#67e8f9',
    shimmer: true,
    diamondGlow: true,
  },
};

export function resolvePlanTier(priceIndex: number, totalPlans: number): PlanTierId {
  if (totalPlans <= 5) return PLAN_TIER_ORDER[priceIndex] ?? 'emerald';
  if (priceIndex < 4) return PLAN_TIER_ORDER[priceIndex];
  return 'diamond';
}

export function buildPlanTierMap(plans: SubscriptionPlan[]): Map<string, PlanTierId> {
  const sorted = [...plans].sort(
    (a, b) => a.priceVnd - b.priceVnd || a.maxAgents - b.maxAgents || a.durationDays - b.durationDays,
  );
  const map = new Map<string, PlanTierId>();
  sorted.forEach((p, index) => {
    map.set(p.id, resolvePlanTier(index, sorted.length));
  });
  return map;
}

/** Xếp hạng gói user trong catalog (+ gói hiện tại nếu không có trong catalog). */
export function resolvePlanTierForPlan(
  plan: SubscriptionPlan | null | undefined,
  catalogPlans: SubscriptionPlan[] = [],
): PlanTierId {
  if (!plan) return 'emerald';
  const merged = new Map<string, SubscriptionPlan>();
  for (const p of catalogPlans) merged.set(p.id, p);
  merged.set(plan.id, plan);
  const map = buildPlanTierMap([...merged.values()]);
  return map.get(plan.id) ?? 'emerald';
}

export function getPlanTierStyle(tier: PlanTierId): PlanTierStyle {
  return PLAN_TIER_STYLES[tier];
}
