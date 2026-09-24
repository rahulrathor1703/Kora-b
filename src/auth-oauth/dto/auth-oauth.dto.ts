import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { AuthOAuthProviderKey } from '../entities/platform-auth-oauth-provider.entity';

export class UpdatePlatformAuthOAuthProviderDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  clientId?: string | null;
}

export class AuthOAuthProviderParamDto {
  @IsIn(['google', 'apple'])
  provider!: AuthOAuthProviderKey;
}

export class OAuthIdTokenDto {
  @IsString()
  idToken!: string;
}

export class SignupOAuthCompleteDto {
  @IsString()
  oauthSignupToken!: string;

  @IsString()
  @MaxLength(120)
  companyName!: string;
}
