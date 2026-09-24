import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type {
  EmailTemplateDelayMode,
  EmailTemplateType,
  EmailTemplateVisibility,
} from '../types/email-template.types';

export class CreateEmailTemplateStepDto {
  @IsInt()
  @Min(1)
  stepOrder!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsOptional()
  @IsIn(['relative', 'absolute'])
  delayMode?: EmailTemplateDelayMode;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  delayDays?: number;

  @ValidateIf(
    (step: CreateEmailTemplateStepDto) => step.delayMode === 'absolute',
  )
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'scheduledDate must be a date in YYYY-MM-DD format',
  })
  scheduledDate?: string;
}

export class CreateEmailTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['single', 'sequence'])
  type!: EmailTemplateType;

  @IsOptional()
  @IsIn(['private', 'org'])
  visibility?: EmailTemplateVisibility;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateEmailTemplateStepDto)
  steps!: CreateEmailTemplateStepDto[];
}

export class UpdateEmailTemplateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['private', 'org'])
  visibility?: EmailTemplateVisibility;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateEmailTemplateStepDto)
  steps?: CreateEmailTemplateStepDto[];
}

export class ListEmailTemplatesQueryDto {
  @IsOptional()
  @IsIn(['single', 'sequence'])
  type?: EmailTemplateType;

  @IsOptional()
  @IsBoolean()
  includeInactive?: boolean;
}
