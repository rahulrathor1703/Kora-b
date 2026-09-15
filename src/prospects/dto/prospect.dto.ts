import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { FieldStoredValue } from '../../common/location/location-field.types';
import type {
  ProspectEngagementOutcome,
  ProspectEngagementType,
} from '../entities/prospect-engagement.entity';
import { USER_CREATABLE_ENGAGEMENT_TYPES } from '../entities/prospect-engagement.entity';
import type { ProspectFieldType } from '../types/prospect-field-schema';

const PROSPECT_FIELD_TYPES: ProspectFieldType[] = [
  'text',
  'email',
  'phone',
  'textarea',
  'select',
  'multiselect',
  'number',
  'date',
  'location',
  'section',
];

export class ProspectFieldOptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  value!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string;
}

export class ProspectFieldDefinitionDto {
  @IsUUID()
  id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  key!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label!: string;

  @IsIn(PROSPECT_FIELD_TYPES)
  type!: ProspectFieldType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsInt()
  @Min(0)
  sortOrder!: number;

  @IsBoolean()
  showInTable!: boolean;

  @IsBoolean()
  showInForm!: boolean;

  @IsOptional()
  @IsBoolean()
  filterable?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProspectFieldOptionDto)
  options?: ProspectFieldOptionDto[];

  @IsOptional()
  @IsBoolean()
  system?: boolean;

  @IsOptional()
  @IsBoolean()
  pipelineStage?: boolean;

  @IsOptional()
  @IsBoolean()
  editableOnDetail?: boolean;

  @IsOptional()
  @IsArray()
  @IsIn(['city', 'state', 'country', 'region'], { each: true })
  locationComponents?: Array<'city' | 'state' | 'country' | 'region'>;

  @IsOptional()
  @IsIn(['api', 'manual'])
  locationInputMode?: 'api' | 'manual';

  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  formColSpan?: number;
}

export class UpdateProspectFieldSchemaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProspectFieldDefinitionDto)
  fields!: ProspectFieldDefinitionDto[];
}

export class CreateProspectDto {
  @IsObject()
  values!: Record<string, FieldStoredValue>;
}

export class UpdateProspectDto {
  @IsObject()
  values!: Record<string, FieldStoredValue>;
}

export const FOLLOW_UP_RANGES = [
  'overdue',
  'today',
  'week',
  'month',
  'all',
] as const;

export type FollowUpRange = (typeof FOLLOW_UP_RANGES)[number];

export class ProspectsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 25;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as Record<string, string>;
      } catch {
        return undefined;
      }
    }

    return value;
  })
  @IsObject()
  filters?: Record<string, string>;

  @IsOptional()
  @IsIn(FOLLOW_UP_RANGES)
  followUpRange?: FollowUpRange;
}

export class PipelineSummaryQueryDto {
  @IsOptional()
  @IsIn(FOLLOW_UP_RANGES)
  followUpRange?: FollowUpRange;
}

export class ProspectSearchQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 10;
}

export class CreateProspectEngagementDto {
  @IsIn(USER_CREATABLE_ENGAGEMENT_TYPES)
  type!: ProspectEngagementType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  discussion!: string;

  @IsIn(['positive', 'neutral', 'negative', 'no-answer'])
  outcome!: ProspectEngagementOutcome;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  nextStep?: string;
}

export class FollowUpsQueryDto {
  @IsIn(FOLLOW_UP_RANGES)
  range!: FollowUpRange;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 25;
}
