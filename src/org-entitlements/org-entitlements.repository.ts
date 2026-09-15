import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationEntitlementsEntity } from './entities/organization-entitlements.entity';
import {
  getDefaultEnabledModules,
  getDefaultPlatformCaps,
} from './org-entitlements.registry';
import type { OrgLimitsMap } from './types/org-entitlements.types';
import type { OrgModule } from './org-entitlements.registry';

@Injectable()
export class OrgEntitlementsRepository {
  constructor(
    @InjectRepository(OrganizationEntitlementsEntity)
    private readonly repository: Repository<OrganizationEntitlementsEntity>,
  ) {}

  findByOrganizationId(
    organizationId: string,
  ): Promise<OrganizationEntitlementsEntity | null> {
    return this.repository.findOne({ where: { organizationId } });
  }

  async getOrCreate(
    organizationId: string,
  ): Promise<OrganizationEntitlementsEntity> {
    const existing = await this.findByOrganizationId(organizationId);

    if (existing) {
      return existing;
    }

    const created = this.repository.create({
      organizationId,
      enabledModules: getDefaultEnabledModules(),
      platformCaps: getDefaultPlatformCaps(),
      orgLimits: {},
    });

    return this.repository.save(created);
  }

  async updatePlatformEntitlements(
    organizationId: string,
    data: {
      enabledModules?: OrgModule[];
      platformCaps?: OrgLimitsMap;
    },
  ): Promise<OrganizationEntitlementsEntity> {
    const row = await this.getOrCreate(organizationId);

    if (data.enabledModules) {
      row.enabledModules = data.enabledModules;
    }

    if (data.platformCaps) {
      row.platformCaps = {
        ...row.platformCaps,
        ...data.platformCaps,
      };
    }

    return this.repository.save(row);
  }

  async updateOrgLimits(
    organizationId: string,
    orgLimits: OrgLimitsMap,
  ): Promise<OrganizationEntitlementsEntity> {
    const row = await this.getOrCreate(organizationId);
    row.orgLimits = orgLimits;
    return this.repository.save(row);
  }
}
