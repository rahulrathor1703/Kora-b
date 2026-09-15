import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AuthOAuthProviderKey } from './entities/platform-auth-oauth-provider.entity';
import { PlatformAuthOAuthService } from './platform-auth-oauth.service';

export interface VerifiedOAuthProfile {
  provider: AuthOAuthProviderKey;
  subjectId: string;
  email: string;
}

const APPLE_JWKS = createRemoteJWKSet(
  new URL('https://appleid.apple.com/auth/keys'),
);

@Injectable()
export class OAuthAuthService {
  constructor(
    private readonly platformAuthOAuthService: PlatformAuthOAuthService,
  ) {}

  async verifyGoogleIdToken(idToken: string): Promise<VerifiedOAuthProfile> {
    const clientId =
      await this.platformAuthOAuthService.getEnabledClientId('google');
    const client = new OAuth2Client(clientId);

    let payload: {
      sub?: string;
      email?: string;
      email_verified?: boolean | string;
    };

    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });
      payload = ticket.getPayload() ?? {};
    } catch {
      throw new UnauthorizedException('Invalid Google sign-in token');
    }

    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Google account email is required');
    }

    if (
      payload.email_verified === false ||
      payload.email_verified === 'false'
    ) {
      throw new UnauthorizedException('Google account email is not verified');
    }

    return {
      provider: 'google',
      subjectId: payload.sub,
      email: payload.email.toLowerCase().trim(),
    };
  }

  async verifyAppleIdToken(idToken: string): Promise<VerifiedOAuthProfile> {
    const clientId =
      await this.platformAuthOAuthService.getEnabledClientId('apple');

    let payload: {
      sub?: string;
      email?: string;
      email_verified?: boolean | string;
    };

    try {
      const verified = await jwtVerify(idToken, APPLE_JWKS, {
        issuer: 'https://appleid.apple.com',
        audience: clientId,
      });
      payload = verified.payload;
    } catch {
      throw new UnauthorizedException('Invalid Apple sign-in token');
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Apple account identifier is required');
    }

    if (!payload.email) {
      throw new BadRequestException(
        'Apple did not share an email address. Use a different sign-in method or try again.',
      );
    }

    if (
      payload.email_verified === false ||
      payload.email_verified === 'false'
    ) {
      throw new UnauthorizedException('Apple account email is not verified');
    }

    return {
      provider: 'apple',
      subjectId: payload.sub,
      email: payload.email.toLowerCase().trim(),
    };
  }
}
