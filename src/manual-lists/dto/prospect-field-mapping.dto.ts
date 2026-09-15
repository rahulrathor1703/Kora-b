import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ProspectFieldMappingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  emailColumnKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  nameColumnKey?: string;
}
