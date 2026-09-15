import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsObject,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateManualListRowDto {
  @IsObject()
  @IsNotEmpty()
  values!: Record<string, string>;
}

export class ManualListColumnMappingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  listColumnKey!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  sourceColumn!: string;
}

export class AppendManualListImportDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ManualListColumnMappingDto)
  columnMappings!: ManualListColumnMappingDto[];
}
