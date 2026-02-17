import type { Profile } from "../shared/schema";

export const LIMITS = {
  guest: {
    maxRows: 25,
    maxRulesets: 0,
    csvExport: false,
  },
  free: {
    maxRows: 100,
    maxRulesets: 2,
    csvExport: false,
  },
  pro: {
    maxRows: Infinity,
    maxRulesets: 50,
    csvExport: true,
  },
} as const;

export type PlanTier = "guest" | "free" | "pro";

export function isPro(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  const status = profile.subscriptionStatus;

  if (status === "active" || status === "trialing" || status === "past_due") {
    return true;
  }

  if (status === "canceled" && profile.currentPeriodEnd) {
    return new Date(profile.currentPeriodEnd) > new Date();
  }

  return false;
}

export function getPlanTier(profile: Profile | null | undefined, isGuest: boolean): PlanTier {
  if (isGuest || !profile) return "guest";
  if (isPro(profile)) return "pro";
  return "free";
}

export function getLimits(tier: PlanTier) {
  return LIMITS[tier];
}

export function canExportCSV(profile: Profile | null | undefined, isGuest: boolean): boolean {
  return getLimits(getPlanTier(profile, isGuest)).csvExport;
}

export function getMaxRows(profile: Profile | null | undefined, isGuest: boolean): number {
  return getLimits(getPlanTier(profile, isGuest)).maxRows;
}

export function getMaxRulesets(profile: Profile | null | undefined, isGuest: boolean): number {
  return getLimits(getPlanTier(profile, isGuest)).maxRulesets;
}
