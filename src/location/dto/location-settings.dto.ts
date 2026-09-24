import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { LocationProvider } from '../entities/organization-location-settings.entity';

export class UpdateLocationSettingsDto {
  @IsIn(['geonames', 'custom'])
  provider!: LocationProvider;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  apiUsername?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  @IsUrl({ require_protocol: true })
  apiUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  apiKey?: string;
}

export class TestLocationSettingsDto {
  @IsIn(['geonames', 'custom'])
  provider!: LocationProvider;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  apiUsername?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  @IsUrl({ require_protocol: true })
  apiUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  apiKey?: string;
}

export interface LocationSettingsResponse {
  provider: LocationProvider;
  apiUrl: string | null;
  apiUsernameMasked: string | null;
  apiKeyMasked: string | null;
  isConfigured: boolean;
  usesPlatformDefault: boolean;
}
