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
import type { CompanyFieldType } from '../types/company-field-schema';

const COMPANY_FIELD_TYPES: CompanyFieldType[] = [
  'text',
  'email',
  'phone',
  'textarea',
  'select',
  'number',
  'date',
  'company-category',
  'company-location',
  'location',
  'section',
];

export class CompanyFieldOptionDto {
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

export class CompanyFieldDefinitionDto {
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

  @IsIn(COMPANY_FIELD_TYPES)
  type!: CompanyFieldType;

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
  @Type(() => CompanyFieldOptionDto)
  options?: CompanyFieldOptionDto[];

  @IsOptional()
  @IsBoolean()
  system?: boolean;

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

export class UpdateCompanyFieldSchemaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CompanyFieldDefinitionDto)
  fields!: CompanyFieldDefinitionDto[];
}

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  brokerName!: string;

  @IsObject()
  values!: Record<string, FieldStoredValue>;
}

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  brokerName?: string;

  @IsOptional()
  @IsObject()
  values?: Record<string, FieldStoredValue>;
}

export class CompaniesQueryDto {
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
}
