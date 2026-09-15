import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { Response } from 'express';
import { CredentialsCryptoService } from '../../common/crypto/credentials-crypto.service';
import type { WebsitePropertyEntity } from '../../on-page-seo/entities/website-property.entity';
import { OrganizationsService } from '../../organizations/organizations.service';
import type { OrganizationGoogleConnectionEntity } from '../entities/organization-google-connection.entity';
import type {
  GoogleConnectionDto,
  OrganizationGoogleConnectionListItemDto,
  StoredGoogleOAuthTokens,
} from '../types/website.types';
import { OrganizationGoogleConnectionRepository } from './organization-google-connection.repository';
import { WebsiteGoogleOAuthCredentialsService } from './website-google-oauth-credentials.service';
import { WebsitePropertyAccessRepository } from './website-property-access.repository';

interface OAuthStatePayload {
  organizationSlug: string;
  userId: string;
  oauthAppId: string;
  mode: 'org' | 'property';
  websitePropertyId?: string;
  nonce: string;
  expiresAt: number;
}

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
];

@Injectable()
export class WebsiteGoogleConnectionOAuthService {
  private readonly stateTtlMs = 10 * 60 * 1000;

  constructor(
    private readonly config: ConfigService,
    private readonly orgConnectionRepository: OrganizationGoogleConnectionRepository,
    private readonly propertyAccessRepository: WebsitePropertyAccessRepository,
    private readonly credentialsService: WebsiteGoogleOAuthCredentialsService,
    private readonly crypto: CredentialsCryptoService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async getAvailability(organizationId: string): Promise<{ google: boolean }> {
    return {
      google: await this.credentialsService.isConfigured(organizationId),
    };
  }

  async listOrganizationConnections(
    organizationId: string,
    oauthAppId?: string,
  ): Promise<OrganizationGoogleConnectionListItemDto[]> {
    const summaries =
      await this.orgConnectionRepository.findSummariesByOrganizationId(
        organizationId,
        oauthAppId,
      );

    return summaries.map((summary) => ({
      id: summary.id,
      oauthAppId: summary.oauthAppId,
      email: summary.email,
      connectedAt: summary.connectedAt.toISOString(),
      connectedByUserId: summary.connectedByUserId,
      propertyCount: summary.propertyCount,
    }));
  }

  async getOrganizationConnection(
    connectionId: string,
    organizationId: string,
  ): Promise<GoogleConnectionDto | null> {
    const connection =
      await this.orgConnectionRepository.findByIdAndOrganizationId(
        connectionId,
        organizationId,
      );

    return connection ? this.toConnectionDto(connection) : null;
  }

  async getConnection(
    websitePropertyId: string,
    organizationId: string,
  ): Promise<GoogleConnectionDto | null> {
    const property = await this.assertPropertyInOrganization(
      websitePropertyId,
      organizationId,
    );

    if (!property.googleConnectionId) {
      return null;
    }

    const connection =
      await this.orgConnectionRepository.findByIdAndOrganizationId(
        property.googleConnectionId,
        organizationId,
      );

    return connection ? this.toConnectionDto(connection) : null;
  }

  async getConnectionsByPropertyIds(
    propertyIds: string[],
  ): Promise<Map<string, GoogleConnectionDto>> {
    if (propertyIds.length === 0) {
      return new Map();
    }

    const properties = await Promise.all(
      propertyIds.map(async (propertyId) => {
        const organizationId =
          await this.propertyAccessRepository.findOrganizationIdByPropertyId(
            propertyId,
          );
        if (!organizationId) {
          return null;
        }

        const property =
          await this.propertyAccessRepository.findByIdAndOrganizationId(
            propertyId,
            organizationId,
          );

        return property;
      }),
    );

    const connectionIds = [
      ...new Set(
        properties
          .filter(
            (property): property is WebsitePropertyEntity => property !== null,
          )
          .map((property) => property.googleConnectionId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const connections = await Promise.all(
      connectionIds.map((id) => this.orgConnectionRepository.findById(id)),
    );

    const connectionById = new Map(
      connections
        .filter(
          (connection): connection is OrganizationGoogleConnectionEntity =>
            connection !== null,
        )
        .map((connection) => [connection.id, connection]),
    );

    const result = new Map<string, GoogleConnectionDto>();

    for (const property of properties) {
      if (!property?.googleConnectionId) {
        continue;
      }

      const connection = connectionById.get(property.googleConnectionId);
      if (connection) {
        result.set(property.id, this.toConnectionDto(connection));
      }
    }

    return result;
  }

  async buildOrgAuthorizeUrl(input: {
    userId: string;
    organizationSlug: string;
    organizationId: string;
    oauthAppId?: string;
  }): Promise<string> {
    return this.buildAuthorizeUrl({
      ...input,
      mode: 'org',
    });
  }

  async buildPropertyAuthorizeUrl(input: {
    userId: string;
    organizationSlug: string;
    organizationId: string;
    websitePropertyId: string;
    oauthAppId?: string;
  }): Promise<string> {
    await this.assertPropertyInOrganization(
      input.websitePropertyId,
      input.organizationId,
    );

    return this.buildAuthorizeUrl({
      ...input,
      mode: 'property',
      websitePropertyId: input.websitePropertyId,
    });
  }

  async handleCallback(
    code: string,
    state: string,
    res: Response,
  ): Promise<void> {
    const payload = this.verifyState(state);

    const organization = await this.organizationsService.findBySlug(
      payload.organizationSlug,
    );

    if (!organization) {
      this.redirectError(
        res,
        payload.organizationSlug,
        'Organization not found',
        payload.websitePropertyId,
      );
      return;
    }

    if (payload.mode === 'property' && payload.websitePropertyId) {
      try {
        await this.assertPropertyInOrganization(
          payload.websitePropertyId,
          organization.id,
        );
      } catch {
        this.redirectError(
          res,
          payload.organizationSlug,
          'Website not found',
          payload.websitePropertyId,
        );
        return;
      }
    }

    const credentials = await this.credentialsService.resolve(
      payload.oauthAppId,
    );
    if (!credentials) {
      this.redirectError(
        res,
        payload.organizationSlug,
        'Google OAuth is not configured for this organization',
        payload.websitePropertyId,
      );
      return;
    }

    const tokens = await this.exchangeGoogleCode(
      code,
      credentials.clientId,
      credentials.clientSecret,
      payload.oauthAppId,
    );
    if (!tokens.access_token) {
      this.redirectError(
        res,
        payload.organizationSlug,
        'Google sign-in failed',
        payload.websitePropertyId,
      );
      return;
    }

    const email = await this.fetchGoogleEmail(tokens.access_token);
    if (!email) {
      this.redirectError(
        res,
        payload.organizationSlug,
        'Could not read Google account email',
        payload.websitePropertyId,
      );
      return;
    }

    const connection = await this.persistOrganizationConnection(
      organization.id,
      payload.oauthAppId,
      payload.userId,
      email,
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt:
          typeof tokens.expires_in === 'number'
            ? Date.now() + tokens.expires_in * 1000
            : null,
      },
    );

    if (payload.mode === 'property' && payload.websitePropertyId) {
      await this.assignConnectionToProperty(
        payload.websitePropertyId,
        organization.id,
        connection.id,
      );
    }

    this.redirectSuccess(
      res,
      payload.organizationSlug,
      connection.id,
      connection.oauthAppId,
      email,
      payload.websitePropertyId,
    );
  }

  async assignConnectionToProperty(
    websitePropertyId: string,
    organizationId: string,
    connectionId: string,
  ): Promise<GoogleConnectionDto> {
    await this.assertPropertyInOrganization(websitePropertyId, organizationId);

    const connection =
      await this.orgConnectionRepository.findByIdAndOrganizationId(
        connectionId,
        organizationId,
      );

    if (!connection) {
      throw new NotFoundException('Google connection not found');
    }

    await this.propertyAccessRepository.setGoogleConnectionId(
      websitePropertyId,
      organizationId,
      connectionId,
    );

    return this.toConnectionDto(connection);
  }

  async assertConnectionBelongsToOrganization(
    connectionId: string,
    organizationId: string,
  ): Promise<OrganizationGoogleConnectionEntity> {
    const connection =
      await this.orgConnectionRepository.findByIdAndOrganizationId(
        connectionId,
        organizationId,
      );

    if (!connection) {
      throw new NotFoundException('Google connection not found');
    }

    return connection;
  }

  async disconnect(
    websitePropertyId: string,
    organizationId: string,
  ): Promise<void> {
    const property = await this.assertPropertyInOrganization(
      websitePropertyId,
      organizationId,
    );

    if (!property.googleConnectionId) {
      throw new NotFoundException('Google connection not found');
    }

    await this.propertyAccessRepository.setGoogleConnectionId(
      websitePropertyId,
      organizationId,
      null,
    );
  }

  async deleteOrganizationConnection(
    connectionId: string,
    organizationId: string,
  ): Promise<void> {
    await this.assertConnectionBelongsToOrganization(
      connectionId,
      organizationId,
    );

    const propertyCount =
      await this.orgConnectionRepository.countPropertiesUsingConnection(
        connectionId,
      );

    if (propertyCount > 0) {
      throw new BadRequestException(
        'This Google account is still linked to one or more websites. Unlink it first.',
      );
    }

    const deleted = await this.orgConnectionRepository.deleteById(connectionId);
    if (!deleted) {
      throw new NotFoundException('Google connection not found');
    }
  }

  async getValidAccessToken(websitePropertyId: string): Promise<string> {
    const organizationId =
      await this.propertyAccessRepository.findOrganizationIdByPropertyId(
        websitePropertyId,
      );

    if (!organizationId) {
      throw new NotFoundException('Website property not found');
    }

    const property =
      await this.propertyAccessRepository.findByIdAndOrganizationId(
        websitePropertyId,
        organizationId,
      );

    if (!property?.googleConnectionId) {
      throw new NotFoundException(
        'No Google connection found for this website',
      );
    }

    return this.getValidAccessTokenForConnection(
      property.googleConnectionId,
      organizationId,
    );
  }

  async getValidAccessTokenForConnection(
    connectionId: string,
    organizationId: string,
  ): Promise<string> {
    const connection = await this.assertConnectionBelongsToOrganization(
      connectionId,
      organizationId,
    );

    const tokens = this.decryptTokens(connection);
    const expiresSoon =
      connection.expiresAt !== null &&
      connection.expiresAt.getTime() <= Date.now() + 60_000;

    if (!expiresSoon) {
      return tokens.accessToken;
    }

    if (!tokens.refreshToken) {
      throw new UnauthorizedException(
        'Google connection expired. Please reconnect your account.',
      );
    }

    const refreshed = await this.refreshGoogleToken(
      connection.oauthAppId,
      tokens.refreshToken,
    );
    await this.persistOrganizationConnection(
      organizationId,
      connection.oauthAppId,
      connection.connectedByUserId ?? '',
      connection.email,
      refreshed,
    );

    return refreshed.accessToken;
  }

  async hasConnection(websitePropertyId: string): Promise<boolean> {
    const organizationId =
      await this.propertyAccessRepository.findOrganizationIdByPropertyId(
        websitePropertyId,
      );

    if (!organizationId) {
      return false;
    }

    const property =
      await this.propertyAccessRepository.findByIdAndOrganizationId(
        websitePropertyId,
        organizationId,
      );

    return Boolean(property?.googleConnectionId);
  }

  private async buildAuthorizeUrl(input: {
    userId: string;
    organizationSlug: string;
    organizationId: string;
    oauthAppId?: string;
    mode: 'org' | 'property';
    websitePropertyId?: string;
  }): Promise<string> {
    const resolved = await this.credentialsService.resolveForOrganization(
      input.organizationId,
      input.oauthAppId,
    );

    const state = this.signState({
      organizationSlug: input.organizationSlug,
      userId: input.userId,
      oauthAppId: resolved.oauthAppId,
      mode: input.mode,
      websitePropertyId: input.websitePropertyId,
      nonce: randomBytes(16).toString('hex'),
      expiresAt: Date.now() + this.stateTtlMs,
    });

    const params = new URLSearchParams({
      client_id: resolved.clientId,
      redirect_uri: await this.credentialsService.oauthRedirectUri(
        resolved.oauthAppId,
      ),
      response_type: 'code',
      scope: GOOGLE_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  private async assertPropertyInOrganization(
    websitePropertyId: string,
    organizationId: string,
  ): Promise<WebsitePropertyEntity> {
    return this.propertyAccessRepository.requireByIdAndOrganizationId(
      websitePropertyId,
      organizationId,
    );
  }

  private async persistOrganizationConnection(
    organizationId: string,
    oauthAppId: string,
    connectedByUserId: string,
    email: string,
    tokens: StoredGoogleOAuthTokens,
  ): Promise<OrganizationGoogleConnectionEntity> {
    const normalizedEmail = email.toLowerCase();
    const existing =
      await this.orgConnectionRepository.findByOAuthAppIdAndEmail(
        oauthAppId,
        normalizedEmail,
      );

    const entity =
      existing ??
      this.orgConnectionRepository.create({
        organizationId,
        oauthAppId,
      });

    entity.email = normalizedEmail;
    entity.oauthAppId = oauthAppId;
    entity.accessTokenEncrypted = this.crypto.encrypt({
      accessToken: tokens.accessToken,
    });
    entity.refreshTokenEncrypted = tokens.refreshToken
      ? this.crypto.encrypt({ refreshToken: tokens.refreshToken })
      : null;
    entity.expiresAt =
      tokens.expiresAt !== null ? new Date(tokens.expiresAt) : null;
    entity.scopes = GOOGLE_SCOPES.join(' ');
    if (connectedByUserId) {
      entity.connectedByUserId = connectedByUserId;
    }

    return this.orgConnectionRepository.save(entity);
  }

  private toConnectionDto(
    connection: OrganizationGoogleConnectionEntity,
  ): GoogleConnectionDto {
    return {
      id: connection.id,
      oauthAppId: connection.oauthAppId,
      email: connection.email,
      connectedAt: connection.connectedAt.toISOString(),
      connectedByUserId: connection.connectedByUserId,
    };
  }

  private decryptTokens(
    connection: OrganizationGoogleConnectionEntity,
  ): StoredGoogleOAuthTokens {
    const accessPayload = this.crypto.decrypt<{
      accessToken: string;
    }>(connection.accessTokenEncrypted);

    let refreshToken: string | null = null;
    if (connection.refreshTokenEncrypted) {
      const refreshPayload = this.crypto.decrypt<{ refreshToken: string }>(
        connection.refreshTokenEncrypted,
      );
      refreshToken = refreshPayload.refreshToken;
    }

    return {
      accessToken: accessPayload.accessToken,
      refreshToken,
      expiresAt: connection.expiresAt?.getTime() ?? null,
    };
  }

  private async refreshGoogleToken(
    oauthAppId: string,
    refreshToken: string,
  ): Promise<StoredGoogleOAuthTokens> {
    const credentials = await this.credentialsService.resolve(oauthAppId);
    if (!credentials) {
      throw new UnauthorizedException('Google OAuth app not found');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new UnauthorizedException('Failed to refresh Google connection');
    }

    const tokens = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };

    if (!tokens.access_token) {
      throw new UnauthorizedException('Failed to refresh Google connection');
    }

    return {
      accessToken: tokens.access_token,
      refreshToken,
      expiresAt:
        typeof tokens.expires_in === 'number'
          ? Date.now() + tokens.expires_in * 1000
          : null,
    };
  }

  private async exchangeGoogleCode(
    code: string,
    clientId: string,
    clientSecret: string,
    oauthAppId: string,
  ): Promise<{
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  }> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri:
          await this.credentialsService.oauthRedirectUri(oauthAppId),
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      return {};
    }

    return (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
  }

  private async fetchGoogleEmail(accessToken: string): Promise<string | null> {
    const response = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      return null;
    }

    const profile = (await response.json()) as { email?: string };
    return profile.email?.toLowerCase() ?? null;
  }

  private frontendUrl(): string {
    return (
      this.config.get<string>('frontendUrl') ?? 'http://localhost:3007'
    ).replace(/\/$/, '');
  }

  private stateSecret(): string {
    return this.config.get<string>('jwt.secret') ?? 'dev-secret-change-me';
  }

  private signState(payload: OAuthStatePayload): string {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.stateSecret())
      .update(encoded)
      .digest('base64url');
    return `${encoded}.${signature}`;
  }

  private verifyState(state: string): OAuthStatePayload {
    const [encoded, signature] = state.split('.');
    if (!encoded || !signature) {
      throw new BadRequestException('Invalid OAuth state');
    }

    const expected = createHmac('sha256', this.stateSecret())
      .update(encoded)
      .digest('base64url');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      sigBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      throw new BadRequestException('Invalid OAuth state signature');
    }

    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as OAuthStatePayload;

    if (payload.expiresAt <= Date.now()) {
      throw new BadRequestException('OAuth state expired');
    }

    if (payload.mode !== 'org' && payload.mode !== 'property') {
      throw new BadRequestException('Invalid OAuth state');
    }

    if (payload.mode === 'property' && !payload.websitePropertyId) {
      throw new BadRequestException('Invalid OAuth state');
    }

    if (!payload.oauthAppId) {
      throw new BadRequestException('Invalid OAuth state');
    }

    return payload;
  }

  private redirectSuccess(
    res: Response,
    organizationSlug: string,
    connectionId: string,
    oauthAppId: string,
    email: string,
    websitePropertyId?: string,
  ): void {
    const params = new URLSearchParams({
      googleOAuth: 'success',
      connectionId,
      oauthAppId,
      email,
    });

    if (websitePropertyId) {
      params.set('propertyId', websitePropertyId);
    }

    res.redirect(
      `${this.frontendUrl()}/${organizationSlug}/website/configuration?${params.toString()}`,
    );
  }

  private redirectError(
    res: Response,
    organizationSlug: string,
    message: string,
    websitePropertyId?: string,
  ): void {
    const params = new URLSearchParams({
      googleOAuth: 'error',
      message,
    });

    if (websitePropertyId) {
      params.set('propertyId', websitePropertyId);
    }

    res.redirect(
      `${this.frontendUrl()}/${organizationSlug}/website/configuration?${params.toString()}`,
    );
  }
}
