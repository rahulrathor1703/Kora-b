import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ColumnPrefDto {
  @IsString()
  @MaxLength(128)
  field!: string;

  @IsString()
  @MaxLength(128)
  label!: string;

  @IsBoolean()
  visible!: boolean;

  @IsInt()
  @Min(0)
  order!: number;
}

export class ColumnPrefListDto {
  @ValidateNested({ each: true })
  @Type(() => ColumnPrefDto)
  columns!: ColumnPrefDto[];
}
