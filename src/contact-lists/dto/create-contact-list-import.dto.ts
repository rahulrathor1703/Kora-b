import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class AdditionalFieldMappingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  key!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  sourceColumn!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  secondarySourceColumn?: string;
}

export class FieldMappingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  email!: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AdditionalFieldMappingDto)
  additionalFields!: AdditionalFieldMappingDto[];
}

export class CreateContactListImportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ValidateNested()
  @Type(() => FieldMappingDto)
  fieldMapping!: FieldMappingDto;

  @IsOptional()
  @IsBoolean()
  syncToProspects?: boolean;
}
