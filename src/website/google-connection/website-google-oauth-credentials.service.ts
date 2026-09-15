import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CredentialsCryptoService } from '../../common/crypto/credentials-crypto.service';
import { OrganizationGoogleOAuthAppRepository } from '../google-oauth-apps/organization-google-oauth-app.repository';

export interface ResolvedGoogleOAuthCredentials {
  clientId: string;
  clientSecret: string;
  callbackBaseUrl: string;
}

const OAUTH_CALLBACK_PATH = '/website/google-connection/oauth/callback';

@Injectable()
export class WebsiteGoogleOAuthCredentialsService {
  constructor(
    private readonly config: ConfigService,
    private readonly oauthAppRepository: OrganizationGoogleOAuthAppRepository,
    private readonly credentialsCrypto: CredentialsCryptoService,
  ) {}

  async oauthRedirectUri(oauthAppId: string): Promise<string> {
    const baseUrl = await this.resolveOAuthCallbackBaseUrl(oauthAppId);
    return `${baseUrl}${OAUTH_CALLBACK_PATH}`;
  }

  async resolveOAuthCallbackBaseUrl(oauthAppId: string): Promise<string> {
    const entity = await this.oauthAppRepository.findById(oauthAppId);
    const storedBaseUrl = entity?.googleOAuthCallbackBaseUrl?.trim();

    if (storedBaseUrl) {
      return this.normalizeBaseUrl(storedBaseUrl);
    }

    return this.defaultOAuthCallbackBaseUrl();
  }

  defaultOAuthCallbackBaseUrl(): string {
    const fromEnv =
      this.config.get<string>('websiteOAuthCallbackBaseUrl')?.trim() ||
      this.config.get<string>('backendUrl')?.trim();

    if (fromEnv) {
      return this.normalizeBaseUrl(fromEnv);
    }

    const port = this.config.get<number>('port') ?? 3008;
    return `http://localhost:${port}`;
  }

  normalizeBaseUrl(value: string): string {
    let parsed: URL;

    try {
      parsed = new URL(value.includes('://') ? value : `https://${value}`);
    } catch {
      throw new BadRequestException('OAuth callback base URL is invalid');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException(
        'OAuth callback base URL must start with http:// or https://',
      );
    }

    return `${parsed.protocol}//${parsed.host}`;
  }

  async isConfigured(organizationId: string): Promise<boolean> {
    return this.oauthAppRepository.hasAnyForOrganization(organizationId);
  }

  async resolve(
    oauthAppId: string,
  ): Promise<ResolvedGoogleOAuthCredentials | null> {
    const entity = await this.oauthAppRepository.findById(oauthAppId);

    if (
      !entity?.googleOAuthClientId ||
      !entity.googleOAuthClientSecretEncrypted
    ) {
      return null;
    }

    const stored = this.credentialsCrypto.decrypt<{ clientSecret: string }>(
      entity.googleOAuthClientSecretEncrypted,
    );

    const clientId = entity.googleOAuthClientId.trim();
    const clientSecret = stored.clientSecret?.trim();

    if (!clientId || !clientSecret) {
      return null;
    }

    return {
      clientId,
      clientSecret,
      callbackBaseUrl: entity.googleOAuthCallbackBaseUrl,
    };
  }

  async resolveForOrganization(
    organizationId: string,
    oauthAppId?: string,
  ): Promise<ResolvedGoogleOAuthCredentials & { oauthAppId: string }> {
    if (oauthAppId) {
      const entity = await this.oauthAppRepository.findByIdAndOrganizationId(
        oauthAppId,
        organizationId,
      );

      if (!entity) {
        throw new BadRequestException('Google OAuth app not found');
      }

      const credentials = await this.resolve(oauthAppId);
      if (!credentials) {
        throw new BadRequestException(
          'Configure Google OAuth before connecting accounts.',
        );
      }

      return { ...credentials, oauthAppId };
    }

    const apps =
      await this.oauthAppRepository.findByOrganizationId(organizationId);

    if (apps.length === 0) {
      throw new BadRequestException(
        'Configure Google OAuth before connecting accounts.',
      );
    }

    if (apps.length > 1) {
      throw new BadRequestException(
        'Select which Google OAuth app to use before connecting accounts.',
      );
    }

    const credentials = await this.resolve(apps[0].id);
    if (!credentials) {
      throw new BadRequestException(
        'Configure Google OAuth before connecting accounts.',
      );
    }

    return { ...credentials, oauthAppId: apps[0].id };
  }
}
