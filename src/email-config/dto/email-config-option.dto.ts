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
import type { EmailConfigCategory } from '../entities/email-config-option.entity';

export const EMAIL_CONFIG_CATEGORIES = [
  'campaign-type',
  'brand',
  'region',
] as const;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function emptyStringToUndefined(value: unknown): unknown {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }

  return value;
}

export class ListEmailConfigOptionsQueryDto {
  @IsOptional()
  @IsIn(EMAIL_CONFIG_CATEGORIES)
  category?: EmailConfigCategory;
}

export class CreateEmailConfigOptionDto {
  @IsIn(EMAIL_CONFIG_CATEGORIES)
  category!: EmailConfigCategory;

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

export class UpdateEmailConfigOptionDto {
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
