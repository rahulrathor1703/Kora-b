import { BadRequestException, Injectable } from '@nestjs/common';
import { CredentialsCryptoService } from '../../common/crypto/credentials-crypto.service';
import { requireOrganizationId } from '../../common/organization/require-organization-id';
import type {
  TestPsiSettingsDto,
  UpdateGoogleOAuthAppSettingsDto,
  UpdatePsiSettingsDto,
} from '../dto/website-settings.dto';
import type {
  GoogleOAuthAppSettingsResponse,
  PsiSettingsResponse,
} from '../types/website.types';
import { OrganizationGoogleOAuthAppRepository } from '../google-oauth-apps/organization-google-oauth-app.repository';
import { OrganizationGoogleOAuthAppService } from '../google-oauth-apps/organization-google-oauth-app.service';
import { WebsiteGoogleConnectionOAuthService } from '../google-connection/website-google-connection-oauth.service';
import { WebsiteGoogleOAuthCredentialsService } from '../google-connection/website-google-oauth-credentials.service';
import { WebsiteSettingsRepository } from './website-settings.repository';

interface StoredPsiCredentials {
  apiKey?: string;
}

@Injectable()
export class WebsiteSettingsService {
  constructor(
    private readonly settingsRepository: WebsiteSettingsRepository,
    private readonly credentialsCrypto: CredentialsCryptoService,
    private readonly googleOAuthService: WebsiteGoogleConnectionOAuthService,
    private readonly googleOAuthCredentials: WebsiteGoogleOAuthCredentialsService,
    private readonly oauthAppService: OrganizationGoogleOAuthAppService,
    private readonly oauthAppRepository: OrganizationGoogleOAuthAppRepository,
  ) {}

  async getPsiSettings(
    organizationId: string | null,
  ): Promise<PsiSettingsResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const entity = await this.settingsRepository.findByOrganizationId(
      resolvedOrganizationId,
    );
    const connections =
      await this.googleOAuthService.listOrganizationConnections(
        resolvedOrganizationId,
      );

    return {
      hasApiKey: Boolean(entity?.psiApiKeyEncrypted),
      hasGoogleConnection: connections.length > 0,
    };
  }

  async updatePsiSettings(
    dto: UpdatePsiSettingsDto,
    organizationId: string | null,
  ): Promise<PsiSettingsResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);

    if (!dto.apiKey?.trim()) {
      throw new BadRequestException('API key is required');
    }

    await this.testPsiApiKey(dto.apiKey.trim());

    const existing = await this.settingsRepository.findByOrganizationId(
      resolvedOrganizationId,
    );
    const entity =
      existing ?? this.settingsRepository.create(resolvedOrganizationId);

    entity.psiApiKeyEncrypted = this.credentialsCrypto.encrypt({
      apiKey: dto.apiKey.trim(),
    });

    await this.settingsRepository.save(entity);

    return this.getPsiSettings(resolvedOrganizationId);
  }

  async getGoogleOAuthAppSettings(
    organizationId: string | null,
  ): Promise<GoogleOAuthAppSettingsResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const apps = await this.oauthAppService.listApps(resolvedOrganizationId);
    const defaultRedirectBaseUrl =
      this.googleOAuthCredentials.defaultOAuthCallbackBaseUrl();
    const firstApp = apps[0] ?? null;

    return {
      configured: apps.length > 0,
      clientId: firstApp?.clientId ?? null,
      redirectUri:
        firstApp?.redirectUri ??
        `${defaultRedirectBaseUrl}/website/google-connection/oauth/callback`,
      redirectBaseUrl: firstApp?.redirectBaseUrl ?? null,
      defaultRedirectBaseUrl,
    };
  }

  async updateGoogleOAuthAppSettings(
    dto: UpdateGoogleOAuthAppSettingsDto,
    organizationId: string | null,
  ): Promise<GoogleOAuthAppSettingsResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const clientId = dto.clientId.trim();
    const clientSecret = dto.clientSecret.trim();
    const redirectBaseUrl = dto.redirectBaseUrl?.trim();

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Client ID and client secret are required');
    }

    if (!redirectBaseUrl) {
      throw new BadRequestException('OAuth callback base URL is required');
    }

    const existingApps = await this.oauthAppRepository.findByOrganizationId(
      resolvedOrganizationId,
    );

    if (existingApps.length === 0) {
      await this.oauthAppService.createApp(
        {
          label: 'Default',
          clientId,
          clientSecret,
          redirectBaseUrl,
        },
        resolvedOrganizationId,
      );
    } else {
      await this.oauthAppService.updateApp(
        existingApps[0].id,
        {
          clientId,
          clientSecret,
          redirectBaseUrl,
        },
        resolvedOrganizationId,
      );
    }

    return this.getGoogleOAuthAppSettings(resolvedOrganizationId);
  }

  async testPsiSettings(
    dto: TestPsiSettingsDto,
    organizationId: string | null,
    websitePropertyId?: string,
  ): Promise<{ ok: true }> {
    requireOrganizationId(organizationId);

    const apiKey = dto.apiKey?.trim();
    if (apiKey) {
      await this.testPsiApiKey(apiKey, dto.testUrl);
      return { ok: true };
    }

    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const storedKey = await this.resolvePsiApiKey(resolvedOrganizationId);
    if (storedKey) {
      await this.testPsiApiKey(storedKey, dto.testUrl);
      return { ok: true };
    }

    if (websitePropertyId) {
      try {
        const accessToken =
          await this.googleOAuthService.getValidAccessToken(websitePropertyId);
        await this.testPsiWithOAuth(accessToken, dto.testUrl);
        return { ok: true };
      } catch {
        // fall through to error below
      }
    }

    throw new BadRequestException(
      'Connect Google for a website or provide a PageSpeed Insights API key to test.',
    );
  }

  async resolvePsiApiKey(organizationId: string): Promise<string | null> {
    const entity =
      await this.settingsRepository.findByOrganizationId(organizationId);

    if (!entity?.psiApiKeyEncrypted) {
      return null;
    }

    const stored = this.credentialsCrypto.decrypt<StoredPsiCredentials>(
      entity.psiApiKeyEncrypted,
    );

    return stored.apiKey?.trim() ?? null;
  }

  async hasPsiAuth(organizationId: string): Promise<boolean> {
    return Boolean(await this.resolvePsiApiKey(organizationId));
  }

  async hasPsiAuthForProperty(
    organizationId: string,
    websitePropertyId: string,
  ): Promise<boolean> {
    if (await this.hasPsiAuth(organizationId)) {
      return true;
    }

    return this.googleOAuthService.hasConnection(websitePropertyId);
  }

  private async testPsiApiKey(apiKey: string, testUrl?: string): Promise<void> {
    const url = this.resolveTestUrl(testUrl);
    const params = new URLSearchParams({
      url,
      key: apiKey,
      strategy: 'mobile',
    });

    const response = await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`,
    );

    if (!response.ok) {
      throw new BadRequestException(
        'PageSpeed Insights API key test failed. Check the key and try again.',
      );
    }
  }

  private async testPsiWithOAuth(
    accessToken: string,
    testUrl?: string,
  ): Promise<void> {
    const url = this.resolveTestUrl(testUrl);
    const params = new URLSearchParams({
      url,
      strategy: 'mobile',
    });

    const response = await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`,
      {
        headers: { authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      throw new BadRequestException(
        'PageSpeed Insights test failed using Google OAuth.',
      );
    }
  }

  private resolveTestUrl(testUrl?: string): string {
    const trimmed = testUrl?.trim();
    if (!trimmed) {
      return 'https://example.com';
    }

    try {
      return new URL(
        trimmed.includes('://') ? trimmed : `https://${trimmed}`,
      ).toString();
    } catch {
      throw new BadRequestException('Test URL is invalid');
    }
  }
}
