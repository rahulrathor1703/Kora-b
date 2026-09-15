import { Injectable } from '@nestjs/common';
import {
  ORG_LIMIT_DEFINITIONS,
  ORG_LIMIT_KEYS,
  type OrgLimitKey,
} from './org-entitlements.registry';
import { OrgLimitReachedException } from './org-limit-reached.exception';
import { OrgEntitlementsRepository } from './org-entitlements.repository';
import { OrgQuotaRepository } from './org-quota.repository';
import type { OrgLimitsMap } from './types/org-entitlements.types';

@Injectable()
export class OrgQuotaService {
  constructor(
    private readonly orgEntitlementsRepository: OrgEntitlementsRepository,
    private readonly orgQuotaRepository: OrgQuotaRepository,
  ) {}

  async getUsage(
    organizationId: string,
    limitKey: OrgLimitKey,
  ): Promise<number> {
    const definition = ORG_LIMIT_DEFINITIONS[limitKey];
    return this.orgQuotaRepository.countByQuery(
      organizationId,
      definition.countQuery,
    );
  }

  async assertWithinLimit(
    organizationId: string,
    limitKey: OrgLimitKey,
  ): Promise<void> {
    const row =
      await this.orgEntitlementsRepository.getOrCreate(organizationId);
    const effectiveLimit = this.resolveEffectiveLimit(limitKey, row);

    if (effectiveLimit == null) {
      return;
    }

    const currentUsage = await this.getUsage(organizationId, limitKey);

    if (currentUsage >= effectiveLimit) {
      throw new OrgLimitReachedException(
        limitKey,
        effectiveLimit,
        currentUsage,
        ORG_LIMIT_DEFINITIONS[limitKey].label,
      );
    }
  }

  resolveEffectiveLimit(
    limitKey: OrgLimitKey,
    entitlements: {
      platformCaps: OrgLimitsMap;
      orgLimits: OrgLimitsMap;
    },
  ): number | null {
    const orgLimit = entitlements.orgLimits[limitKey];

    if (orgLimit !== undefined) {
      return orgLimit;
    }

    const platformCap = entitlements.platformCaps[limitKey];

    if (platformCap !== undefined) {
      return platformCap;
    }

    return ORG_LIMIT_DEFINITIONS[limitKey].defaultCap;
  }

  resolvePlatformCap(
    limitKey: OrgLimitKey,
    entitlements: { platformCaps: OrgLimitsMap },
  ): number | null {
    const platformCap = entitlements.platformCaps[limitKey];

    if (platformCap !== undefined) {
      return platformCap;
    }

    return ORG_LIMIT_DEFINITIONS[limitKey].defaultCap;
  }

  async buildUsageMap(
    organizationId: string,
  ): Promise<Record<OrgLimitKey, number>> {
    const entries = await Promise.all(
      ORG_LIMIT_KEYS.map(async (limitKey) => {
        const used = await this.getUsage(organizationId, limitKey);
        return [limitKey, used] as const;
      }),
    );

    return Object.fromEntries(entries) as Record<OrgLimitKey, number>;
  }
}
