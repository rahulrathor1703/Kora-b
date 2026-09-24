import type { OrgLimitKey, OrgModule } from '../org-entitlements.registry';

export type OrgLimitValue = number | null;

export type OrgLimitsMap = Partial<Record<OrgLimitKey, OrgLimitValue>>;

export interface OrgLimitUsage {
  effective: number | null;
  used: number;
  platformCap: number | null;
  orgLimit: number | null;
}

export interface OrgEntitlementsSnapshot {
  organizationId: string;
  enabledModules: OrgModule[];
  platformCaps: OrgLimitsMap;
  orgLimits: OrgLimitsMap;
  limits: Record<OrgLimitKey, OrgLimitUsage>;
}

export interface OrgEntitlementsAuthSummary {
  enabledModules: OrgModule[];
  limits: Record<
    OrgLimitKey,
    {
      effective: number | null;
      used: number;
    }
  >;
}
