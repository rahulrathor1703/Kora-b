import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { AbacPolicyConditions, AbacPolicyEffect } from '../abac.types';

class HierarchyLevelConditionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  min?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  max?: number;
}

class AbacPolicyConditionsDto implements AbacPolicyConditions {
  @IsOptional()
  @ValidateNested()
  @Type(() => HierarchyLevelConditionDto)
  hierarchyLevel?: HierarchyLevelConditionDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleSlugs?: string[];

  @IsOptional()
  @IsIn(['active', 'disabled'])
  status?: 'active' | 'disabled';
}

export class CreateAbacPolicyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsString()
  @MaxLength(50)
  resource!: string;

  @IsString()
  @MaxLength(50)
  action!: string;

  @IsIn(['allow', 'deny'])
  effect!: AbacPolicyEffect;

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
