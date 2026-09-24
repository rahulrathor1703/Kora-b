import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import type { CompanyConfigCategory } from '../entities/company-config-option.entity';

export const COMPANY_CONFIG_CATEGORIES = ['category', 'location'] as const;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function emptyStringToUndefined(value: unknown): unknown {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }

  return value;
}

export class ListCompanyConfigOptionsQueryDto {
  @IsOptional()
  @IsIn(COMPANY_CONFIG_CATEGORIES)
  category?: CompanyConfigCategory;
}

export class CreateCompanyConfigOptionDto {
  @IsIn(COMPANY_CONFIG_CATEGORIES)
  category!: CompanyConfigCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label!: string;

  @Transform(({ value }: { value: unknown }) => emptyStringToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(SLUG_PATTERN, {
    message: 'Value must contain only lowercase letters, numbers, and hyphens',
  })
  value?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateCompanyConfigOptionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label?: string;

  @Transform(({ value }: { value: unknown }) => emptyStringToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(SLUG_PATTERN, {
    message: 'Value must contain only lowercase letters, numbers, and hyphens',
  })
  value?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
