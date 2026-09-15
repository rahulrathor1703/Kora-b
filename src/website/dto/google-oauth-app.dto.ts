import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateGoogleOAuthAppDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  label?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(512)
  clientId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(512)
  clientSecret!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  redirectBaseUrl!: string;
}

export class UpdateGoogleOAuthAppDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  label?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  clientId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  clientSecret?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  redirectBaseUrl?: string;
}
