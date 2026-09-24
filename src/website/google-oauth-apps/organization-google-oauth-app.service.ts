import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CredentialsCryptoService } from '../../common/crypto/credentials-crypto.service';
import type {
  CreateGoogleOAuthAppDto,
  UpdateGoogleOAuthAppDto,
} from '../dto/google-oauth-app.dto';
import type { GoogleOAuthAppListItemDto } from '../types/website.types';
import { WebsiteGoogleOAuthCredentialsService } from '../google-connection/website-google-oauth-credentials.service';
import { OrganizationGoogleOAuthAppRepository } from './organization-google-oauth-app.repository';

const OAUTH_CALLBACK_PATH = '/website/google-connection/oauth/callback';

@Injectable()
export class OrganizationGoogleOAuthAppService {
  constructor(
    private readonly oauthAppRepository: OrganizationGoogleOAuthAppRepository,
    private readonly credentialsCrypto: CredentialsCryptoService,
    private readonly credentialsService: WebsiteGoogleOAuthCredentialsService,
  ) {}

  async listApps(organizationId: string): Promise<GoogleOAuthAppListItemDto[]> {
    const summaries =
      await this.oauthAppRepository.findSummariesByOrganizationId(
        organizationId,
      );

    return summaries.map((summary) => ({
      id: summary.id,
      label: summary.label,
      clientId: summary.clientId,
      redirectBaseUrl: summary.redirectBaseUrl,
      redirectUri: `${summary.redirectBaseUrl.replace(/\/$/, '')}${OAUTH_CALLBACK_PATH}`,
      connectionCount: summary.connectionCount,
      createdAt: summary.createdAt.toISOString(),
    }));
  }

  async createApp(
    dto: CreateGoogleOAuthAppDto,
    organizationId: string,
  ): Promise<GoogleOAuthAppListItemDto> {
    const clientId = dto.clientId.trim();
    const clientSecret = dto.clientSecret.trim();
    const redirectBaseUrl = dto.redirectBaseUrl.trim();
    const label = dto.label?.trim() || 'Default';

    if (!clientId || !clientSecret || !redirectBaseUrl) {
      throw new BadRequestException(
        'Client ID, client secret, and callback base URL are required',
      );
    }

    const entity = this.oauthAppRepository.create({
      organizationId,
      label,
      googleOAuthClientId: clientId,
      googleOAuthClientSecretEncrypted: this.credentialsCrypto.encrypt({
        clientSecret,
      }),
      googleOAuthCallbackBaseUrl:
        this.credentialsService.normalizeBaseUrl(redirectBaseUrl),
    });

    const saved = await this.oauthAppRepository.save(entity);
    const apps = await this.listApps(organizationId);
    const created = apps.find((app) => app.id === saved.id);

    if (!created) {
      throw new BadRequestException('Failed to create OAuth app');
    }

    return created;
  }

  async updateApp(
    id: string,
    dto: UpdateGoogleOAuthAppDto,
    organizationId: string,
  ): Promise<GoogleOAuthAppListItemDto> {
    const entity = await this.oauthAppRepository.findByIdAndOrganizationId(
      id,
      organizationId,
    );

    if (!entity) {
      throw new NotFoundException('Google OAuth app not found');
    }

    if (dto.label?.trim()) {
      entity.label = dto.label.trim();
    }

    if (dto.clientId?.trim()) {
      entity.googleOAuthClientId = dto.clientId.trim();
    }

    if (dto.clientSecret?.trim()) {
      entity.googleOAuthClientSecretEncrypted = this.credentialsCrypto.encrypt({
        clientSecret: dto.clientSecret.trim(),
      });
    }

    if (dto.redirectBaseUrl?.trim()) {
      entity.googleOAuthCallbackBaseUrl =
        this.credentialsService.normalizeBaseUrl(dto.redirectBaseUrl.trim());
    }

    await this.oauthAppRepository.save(entity);

    const apps = await this.listApps(organizationId);
    const updated = apps.find((app) => app.id === id);

    if (!updated) {
      throw new NotFoundException('Google OAuth app not found');
    }

    return updated;
  }

  async deleteApp(id: string, organizationId: string): Promise<void> {
    const entity = await this.oauthAppRepository.findByIdAndOrganizationId(
      id,
      organizationId,
    );

    if (!entity) {
      throw new NotFoundException('Google OAuth app not found');
    }

    const connectionCount =
      await this.oauthAppRepository.countConnectionsUsingApp(id);

    if (connectionCount > 0) {
      throw new BadRequestException(
        'This OAuth app still has connected Google accounts. Remove them first.',
      );
    }

    const deleted = await this.oauthAppRepository.deleteById(id);
    if (!deleted) {
      throw new NotFoundException('Google OAuth app not found');
    }
  }

  getDefaultRedirectBaseUrl(): string {
    return this.credentialsService.defaultOAuthCallbackBaseUrl();
  }
}
