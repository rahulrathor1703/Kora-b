import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCampaignCustomFieldDefinitionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label!: string;

  @IsIn(['select', 'text'])
  type!: 'select' | 'text';
}

export class UpdateCampaignCustomFieldDefinitionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsIn(['select', 'text'])
  type?: 'select' | 'text';

  @IsOptional()
  isActive?: boolean;
}

export class CreateCampaignCustomFieldOptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  value?: string;
}
