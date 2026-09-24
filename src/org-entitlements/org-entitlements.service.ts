import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationsService } from '../organizations/organizations.service';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import {
  ORG_LIMIT_DEFINITIONS,
  ORG_LIMIT_KEYS,
  ORG_MODULES,
  getDefaultPlatformCaps,
  isOrgLimitKey,
  isOrgModule,
  type OrgLimitKey,
  type OrgModule,
} from './org-entitlements.registry';
import { ModuleDisabledException } from './module-disabled.exception';
import { OrgEntitlementsRepository } from './org-entitlements.repository';
import { OrgQuotaService } from './org-quota.service';
import type {
  OrgEntitlementsAuthSummary,
  OrgEntitlementsSnapshot,
  OrgLimitUsage,
  OrgLimitsMap,
} from './types/org-entitlements.types';

@Injectable()
export class OrgEntitlementsService {
  constructor(
    private readonly orgEntitlementsRepository: OrgEntitlementsRepository,
    private readonly orgQuotaService: OrgQuotaService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async getSnapshot(organizationId: string): Promise<OrgEntitlementsSnapshot> {
    await this.assertOrganizationExists(organizationId);
    const row =
      await this.orgEntitlementsRepository.getOrCreate(organizationId);
    const usage = await this.orgQuotaService.buildUsageMap(organizationId);

    const limits = ORG_LIMIT_KEYS.reduce(
      (acc, limitKey) => {
        acc[limitKey] = {
          effective: this.orgQuotaService.resolveEffectiveLimit(limitKey, row),
          used: usage[limitKey],
          platformCap: this.orgQuotaService.resolvePlatformCap(limitKey, row),
          orgLimit: row.orgLimits[limitKey] ?? null,
        };
        return acc;
      },
      {} as Record<OrgLimitKey, OrgLimitUsage>,
    );

    return {
      organizationId,
      enabledModules: row.enabledModules,
      platformCaps: this.mergePlatformCaps(row.platformCaps),
      orgLimits: row.orgLimits,
      limits,
    };
  }

  async getAuthSummary(
    organizationId: string,
  ): Promise<OrgEntitlementsAuthSummary> {
    const snapshot = await this.getSnapshot(organizationId);

    return {
      enabledModules: snapshot.enabledModules,
      limits: ORG_LIMIT_KEYS.reduce(
        (acc, limitKey) => {
          acc[limitKey] = {
            effective: snapshot.limits[limitKey].effective,
            used: snapshot.limits[limitKey].used,
          };
          return acc;
        },
        {} as OrgEntitlementsAuthSummary['limits'],
      ),
    };
  }

  async assertModuleEnabled(
    organizationId: string,
    module: OrgModule,
  ): Promise<void> {
    const row =
      await this.orgEntitlementsRepository.getOrCreate(organizationId);

    if (!row.enabledModules.includes(module)) {
      throw new ModuleDisabledException(module);
    }
  }

  async updatePlatformEntitlements(
    organizationId: string,
    input: {
      enabledModules?: OrgModule[];
      platformCaps?: OrgLimitsMap;
    },
  ): Promise<OrgEntitlementsSnapshot> {
    await this.assertOrganizationExists(organizationId);

    if (input.enabledModules) {
      this.validateEnabledModules(input.enabledModules);
    }

    if (input.platformCaps) {
      this.validatePlatformCaps(input.platformCaps);
    }

    const current =
      await this.orgEntitlementsRepository.getOrCreate(organizationId);

    if (input.platformCaps) {
      this.validateCapsAgainstOrgLimits(current.orgLimits, input.platformCaps);
    }

    await this.orgEntitlementsRepository.updatePlatformEntitlements(
      organizationId,
      input,
    );

    return this.getSnapshot(organizationId);
  }

  async updateOrgLimits(
    organizationId: string,
    orgLimits: OrgLimitsMap,
  ): Promise<OrgEntitlementsSnapshot> {
    await this.assertOrganizationExists(organizationId);
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const current = await this.orgEntitlementsRepository.getOrCreate(
      resolvedOrganizationId,
    );

    this.validateOrgLimits(orgLimits, current.platformCaps);

    await this.orgEntitlementsRepository.updateOrgLimits(
      resolvedOrganizationId,
      orgLimits,
    );

    return this.getSnapshot(resolvedOrganizationId);
  }

  isModuleEnabled(enabledModules: OrgModule[], module: OrgModule): boolean {
    return enabledModules.includes(module);
  }

  private async assertOrganizationExists(
    organizationId: string,
  ): Promise<void> {
    const organization =
      await this.organizationsService.findById(organizationId);

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
  }

  private validateEnabledModules(enabledModules: OrgModule[]): void {
    const uniqueModules = new Set(enabledModules);

    if (uniqueModules.size !== enabledModules.length) {
      throw new BadRequestException('Duplicate module entries are not allowed');
    }

    for (const moduleName of enabledModules) {
      if (!isOrgModule(moduleName)) {
        throw new BadRequestException(`Unknown module: ${String(moduleName)}`);
      }
    }
  }

  private validatePlatformCaps(platformCaps: OrgLimitsMap): void {
    for (const [key, value] of Object.entries(platformCaps)) {
      if (!isOrgLimitKey(key)) {
        throw new BadRequestException(`Unknown limit key: ${key}`);
      }

      this.validateLimitValue(key, value);
    }
  }

  private validateOrgLimits(
    orgLimits: OrgLimitsMap,
    platformCaps: OrgLimitsMap,
  ): void {
    for (const [key, value] of Object.entries(orgLimits)) {
      if (!isOrgLimitKey(key)) {
        throw new BadRequestException(`Unknown limit key: ${key}`);
      }

      this.validateLimitValue(key, value);

      const platformCap = this.orgQuotaService.resolvePlatformCap(key, {
        platformCaps,
      });

      if (value != null && platformCap != null && value > platformCap) {
        throw new BadRequestException(
          `${ORG_LIMIT_DEFINITIONS[key].label} cannot exceed the platform cap of ${platformCap}`,
        );
      }
    }
  }

  private validateCapsAgainstOrgLimits(
    orgLimits: OrgLimitsMap,
    platformCaps: OrgLimitsMap,
  ): void {
    for (const [key, capValue] of Object.entries(platformCaps)) {
      if (!isOrgLimitKey(key) || capValue == null) {
        continue;
      }

      const orgLimit = orgLimits[key];

      if (orgLimit != null && orgLimit > capValue) {
        throw new BadRequestException(
          `Platform cap for ${ORG_LIMIT_DEFINITIONS[key].label} cannot be lower than the org limit of ${orgLimit}`,
        );
      }
    }
  }

  private validateLimitValue(
    limitKey: OrgLimitKey,
    value: number | null,
  ): void {
    if (value == null) {
      return;
    }

    if (!Number.isInteger(value) || value < 0) {
      throw new BadRequestException(
        `${ORG_LIMIT_DEFINITIONS[limitKey].label} must be a non-negative integer or null`,
      );
    }
  }

  private mergePlatformCaps(platformCaps: OrgLimitsMap): OrgLimitsMap {
    return {
      ...getDefaultPlatformCaps(),
      ...platformCaps,
    };
  }
}

export { ORG_MODULES, ORG_LIMIT_DEFINITIONS, ORG_LIMIT_KEYS };
