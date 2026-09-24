import { IsArray, IsIn, IsObject, IsOptional } from 'class-validator';
import {
  ORG_MODULES,
  ORG_LIMIT_KEYS,
  type OrgModule,
} from '../org-entitlements.registry';
import type { OrgLimitsMap } from '../types/org-entitlements.types';

export class UpdatePlatformEntitlementsDto {
  @IsOptional()
  @IsArray()
  @IsIn(ORG_MODULES, { each: true })
  enabledModules?: OrgModule[];

  @IsOptional()
  @IsObject()
  platformCaps?: OrgLimitsMap;
}

export class UpdateOrgLimitsDto {
  @IsObject()
  orgLimits!: OrgLimitsMap;
}

export function isValidOrgLimitPayload(
  orgLimits: Record<string, unknown>,
): orgLimits is OrgLimitsMap {
  return Object.keys(orgLimits).every((key) =>
    (ORG_LIMIT_KEYS as readonly string[]).includes(key),
  );
}
