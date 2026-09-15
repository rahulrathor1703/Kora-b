import { IsArray, IsIn, IsObject, IsOptional } from 'class-validator';
import {
  ORG_MODULES,
  type OrgModule,
} from '../../org-entitlements/org-entitlements.registry';
import type { OrgLimitsMap } from '../../org-entitlements/types/org-entitlements.types';

export class UpdatePlatformEntitlementsDto {
  @IsOptional()
  @IsArray()
  @IsIn(ORG_MODULES, { each: true })
  enabledModules?: OrgModule[];

  @IsOptional()
  @IsObject()
  platformCaps?: OrgLimitsMap;
}

export class PlatformEntitlementsResponseDto {
  organizationId!: string;
  enabledModules!: OrgModule[];
  platformCaps!: OrgLimitsMap;
  orgLimits!: OrgLimitsMap;
  limits!: Record<
    string,
    {
      effective: number | null;
      used: number;
      platformCap: number | null;
      orgLimit: number | null;
    }
  >;
}
