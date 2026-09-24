import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ManualListColumnDto } from './manual-list-column.dto';
import { ManualListRowDto } from './manual-list-row.dto';
import { ProspectFieldMappingDto } from './prospect-field-mapping.dto';

export class CreateManualListDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ManualListColumnDto)
  columns!: ManualListColumnDto[];

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ManualListRowDto)
  rows!: ManualListRowDto[];

  @IsOptional()
  @IsBoolean()
  syncToProspects?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProspectFieldMappingDto)
  prospectFieldMapping?: ProspectFieldMappingDto;
}
