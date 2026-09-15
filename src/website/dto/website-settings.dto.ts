import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdatePsiSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  apiKey?: string;
}

export class TestPsiSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  testUrl?: string;
}

export class UpdateGoogleOAuthAppSettingsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  clientId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(512)
  clientSecret!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  redirectBaseUrl?: string;
}
