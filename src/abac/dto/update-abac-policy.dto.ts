import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { AbacPolicyConditions, AbacPolicyEffect } from '../abac.types';

class HierarchyLevelConditionDto {
  min?: number;
  max?: number;
}

class AbacPolicyConditionsDto implements AbacPolicyConditions {
  hierarchyLevel?: HierarchyLevelConditionDto;
  roleSlugs?: string[];
  status?: 'active' | 'disabled';
}

export class UpdateAbacPolicyDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  resource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  action?: string;

  @IsOptional()
  @IsIn(['allow', 'deny'])
  effect?: AbacPolicyEffect;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => AbacPolicyConditionsDto)
  conditions?: AbacPolicyConditionsDto;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  userIds?: string[];
}
