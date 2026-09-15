import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class BantCriterionOptionDto {
  @IsString()
  @MinLength(1)
  id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  value!: string;

  @IsInt()
  @Min(0)
  @Max(100)
  points!: number;

  @IsInt()
  @Min(0)
  sortOrder!: number;

  @IsBoolean()
  isActive!: boolean;
}

export class BantCriterionDto {
  @IsString()
  @MinLength(1)
  id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsInt()
  @Min(1)
  @Max(100)
  weight!: number;

  @IsInt()
  @Min(0)
  sortOrder!: number;

  @IsBoolean()
  isActive!: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BantCriterionOptionDto)
  options!: BantCriterionOptionDto[];
}

export class BantTierThresholdDto {
  @IsString()
  @MinLength(1)
  id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  value!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @IsInt()
  @Min(0)
  @Max(100)
  minScore!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  maxScore!: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string;

  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class UpdateBantSettingsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BantCriterionDto)
  criteria!: BantCriterionDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BantTierThresholdDto)
  tiers!: BantTierThresholdDto[];
}

export class UpdateProspectBantDto {
  @IsObject()
  responses!: Record<string, string>;
}
