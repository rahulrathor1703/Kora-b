import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { Response } from 'express';
import { CredentialsCryptoService } from '../common/crypto/credentials-crypto.service';
import { CalendarConnectionsRepository } from './calendar-connections.repository';
import type {
  CalendarConnectionProvider,
  StoredOAuthTokens,
} from './types/calendar-connection.types';

interface OAuthStatePayload {
  userId: string;
  organizationSlug: string;
  provider: CalendarConnectionProvider;
  nonce: string;
  expiresAt: number;
}

@Injectable()
export class CalendarConnectionsOAuthService {
  private readonly stateTtlMs = 10 * 60 * 1000;

  constructor(
    private readonly config: ConfigService,
    private readonly repository: CalendarConnectionsRepository,
    private readonly crypto: CredentialsCryptoService,
  ) {}

  getAvailability(): Record<CalendarConnectionProvider, boolean> {
    return {
      google: Boolean(this.config.get<string>('oauth.google.clientId')),
      outlook: Boolean(this.config.get<string>('oauth.microsoft.clientId')),
      zoom: Boolean(this.config.get<string>('oauth.zoom.clientId')),
    };
  }

  buildGoogleAuthorizeUrl(input: {
    userId: string;
    organizationSlug: string;
  }): string {
    const clientId = this.requireGoogleClientId();

    const state = this.signState({
      userId: input.userId,
      organizationSlug: input.organizationSlug,
      provider: 'google',
      nonce: randomBytes(16).toString('hex'),
      expiresAt: Date.now() + this.stateTtlMs,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.googleRedirectUri(),
      response_type: 'code',
      scope: [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/userinfo.email',
        'openid',
      ].join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  buildMicrosoftAuthorizeUrl(input: {
    userId: string;
    organizationSlug: string;
  }): string {
    const clientId = this.requireMicrosoftClientId();

    const state = this.signState({
      userId: input.userId,
      organizationSlug: input.organizationSlug,
      provider: 'outlook',
      nonce: randomBytes(16).toString('hex'),
      expiresAt: Date.now() + this.stateTtlMs,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.microsoftRedirectUri(),
      response_type: 'code',
      scope: [
        'offline_access',
        'https://graph.microsoft.com/Calendars.ReadWrite',
        'https://graph.microsoft.com/User.Read',
      ].join(' '),
      state,
    });

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  buildZoomAuthorizeUrl(input: {
    userId: string;
    organizationSlug: string;
  }): string {
    const clientId = this.requireZoomClientId();

    const state = this.signState({
      userId: input.userId,
      organizationSlug: input.organizationSlug,
      provider: 'zoom',
      nonce: randomBytes(16).toString('hex'),
      expiresAt: Date.now() + this.stateTtlMs,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.zoomRedirectUri(),
      response_type: 'code',
      state,
    });

    return `https://zoom.us/oauth/authorize?${params.toString()}`;
  }

  async handleGoogleCallback(
    code: string,
    state: string,
    res: Response,
  ): Promise<void> {
    const payload = this.verifyState(state);
    if (payload.provider !== 'google') {
      throw new BadRequestException('OAuth provider mismatch');
    }

    const clientId = this.requireGoogleClientId();
    const clientSecret =
      this.config.get<string>('oauth.google.clientSecret') ?? '';

    const tokens = await this.exchangeGoogleCode(code, clientId, clientSecret);
    if (!tokens.access_token) {
      this.redirectError(
        res,
        payload.organizationSlug,
        'Google sign-in failed',
      );
      return;
    }

    const email = await this.fetchGoogleEmail(tokens.access_token);
    if (!email) {
      this.redirectError(
        res,
        payload.organizationSlug,
        'Could not read Google account email',
      );
      return;
    }

    await this.persistConnection(payload.userId, 'google', email, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt:
        typeof tokens.expires_in === 'number'
          ? Date.now() + tokens.expires_in * 1000
          : null,
    });

    this.redirectSuccess(res, payload.organizationSlug, 'google', email);
  }

  async handleMicrosoftCallback(
    code: string,
    state: string,
    res: Response,
  ): Promise<void> {
    const payload = this.verifyState(state);
    if (payload.provider !== 'outlook') {
      throw new BadRequestException('OAuth provider mismatch');
    }

    const clientId = this.requireMicrosoftClientId();
    const clientSecret =
      this.config.get<string>('oauth.microsoft.clientSecret') ?? '';

    const tokens = await this.exchangeMicrosoftCode(
      code,
      clientId,
      clientSecret,
    );
    if (!tokens.access_token) {
      this.redirectError(
        res,
        payload.organizationSlug,
        'Microsoft sign-in failed',
      );
      return;
    }

    const email = await this.fetchMicrosoftEmail(tokens.access_token);
    if (!email) {
      this.redirectError(
        res,
        payload.organizationSlug,
        'Could not read Microsoft account email',
      );
      return;
    }

    await this.persistConnection(payload.userId, 'outlook', email, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt:
        typeof tokens.expires_in === 'number'
          ? Date.now() + tokens.expires_in * 1000
          : null,
    });

    this.redirectSuccess(res, payload.organizationSlug, 'outlook', email);
  }

  async handleZoomCallback(
    code: string,
    state: string,
    res: Response,
  ): Promise<void> {
    const payload = this.verifyState(state);
    if (payload.provider !== 'zoom') {
      throw new BadRequestException('OAuth provider mismatch');
    }

    const clientId = this.requireZoomClientId();
    const clientSecret =
      this.config.get<string>('oauth.zoom.clientSecret') ?? '';

    const tokenResponse = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.zoomRedirectUri(),
      }),
    });

    if (!tokenResponse.ok) {
      this.redirectError(res, payload.organizationSlug, 'Zoom sign-in failed');
      return;
    }

    const tokens = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!tokens.access_token) {
      this.redirectError(res, payload.organizationSlug, 'Zoom sign-in failed');
      return;
    }

    const profileResponse = await fetch('https://api.zoom.us/v2/users/me', {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    });

    if (!profileResponse.ok) {
      this.redirectError(
        res,
        payload.organizationSlug,
        'Could not read Zoom account email',
      );
      return;
    }

    const profile = (await profileResponse.json()) as { email?: string };
    const email = profile.email?.toLowerCase();
    if (!email) {
      this.redirectError(
        res,
        payload.organizationSlug,
        'Zoom account has no email address',
      );
      return;
    }

    await this.persistConnection(payload.userId, 'zoom', email, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt:
        typeof tokens.expires_in === 'number'
          ? Date.now() + tokens.expires_in * 1000
          : null,
    });

    this.redirectSuccess(res, payload.organizationSlug, 'zoom', email);
  }

  async getValidAccessToken(
    userId: string,
    provider: CalendarConnectionProvider,
  ): Promise<{ accessToken: string; email: string }> {
    const connection = await this.repository.findByUserAndProvider(
      userId,
      provider,
    );

    if (!connection) {
      throw new NotFoundException(`No ${provider} calendar connection found`);
    }

    const tokens = this.decryptTokens(connection);
    const expiresSoon =
      connection.expiresAt !== null &&
      connection.expiresAt.getTime() <= Date.now() + 60_000;

    if (!expiresSoon) {
      return { accessToken: tokens.accessToken, email: connection.email };
    }

    if (!tokens.refreshToken) {
      throw new BadRequestException(
        `${provider} connection expired. Please reconnect your account.`,
      );
    }

    const refreshed = await this.refreshTokens(provider, tokens.refreshToken);
    await this.persistConnection(userId, provider, connection.email, refreshed);

    return { accessToken: refreshed.accessToken, email: connection.email };
  }

  private async refreshTokens(
    provider: CalendarConnectionProvider,
    refreshToken: string,
  ): Promise<StoredOAuthTokens> {
    if (provider === 'google') {
      return this.refreshGoogleToken(refreshToken);
    }

    if (provider === 'outlook') {
      return this.refreshMicrosoftToken(refreshToken);
    }

    return this.refreshZoomToken(refreshToken);
  }

  private async refreshGoogleToken(
    refreshToken: string,
  ): Promise<StoredOAuthTokens> {
    const clientId = this.requireGoogleClientId();
    const clientSecret =
      this.config.get<string>('oauth.google.clientSecret') ?? '';

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to refresh Google connection');
    }

    const tokens = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };

    if (!tokens.access_token) {
      throw new BadRequestException('Failed to refresh Google connection');
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

  private async refreshMicrosoftToken(
    refreshToken: string,
  ): Promise<StoredOAuthTokens> {
    const clientId = this.requireMicrosoftClientId();
    const clientSecret =
      this.config.get<string>('oauth.microsoft.clientSecret') ?? '';

    const response = await fetch(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      },
    );

    if (!response.ok) {
      throw new BadRequestException('Failed to refresh Microsoft connection');
    }

    const tokens = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!tokens.access_token) {
      throw new BadRequestException('Failed to refresh Microsoft connection');
    }

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? refreshToken,
      expiresAt:
        typeof tokens.expires_in === 'number'
          ? Date.now() + tokens.expires_in * 1000
          : null,
    };
  }

  private async refreshZoomToken(
    refreshToken: string,
  ): Promise<StoredOAuthTokens> {
    const clientId = this.requireZoomClientId();
    const clientSecret =
      this.config.get<string>('oauth.zoom.clientSecret') ?? '';

    const response = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to refresh Zoom connection');
    }

    const tokens = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!tokens.access_token) {
      throw new BadRequestException('Failed to refresh Zoom connection');
    }

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? refreshToken,
      expiresAt:
        typeof tokens.expires_in === 'number'
          ? Date.now() + tokens.expires_in * 1000
          : null,
    };
  }

  private async persistConnection(
    userId: string,
    provider: CalendarConnectionProvider,
    email: string,
    tokens: StoredOAuthTokens,
  ): Promise<void> {
    const existing = await this.repository.findByUserAndProvider(
      userId,
      provider,
    );

    await this.repository.upsertConnection({
      id: existing?.id,
      userId,
      provider,
      email: email.toLowerCase(),
      accessTokenEncrypted: this.crypto.encrypt({
        accessToken: tokens.accessToken,
      }),
      refreshTokenEncrypted: tokens.refreshToken
        ? this.crypto.encrypt({ refreshToken: tokens.refreshToken })
        : null,
      expiresAt: tokens.expiresAt ? new Date(tokens.expiresAt) : null,
      scopes: null,
    });
  }

  private decryptTokens(connection: {
    accessTokenEncrypted: string;
    refreshTokenEncrypted: string | null;
  }): StoredOAuthTokens {
    const accessPayload = this.crypto.decrypt<{ accessToken: string }>(
      connection.accessTokenEncrypted,
    );
    const refreshPayload = connection.refreshTokenEncrypted
      ? this.crypto.decrypt<{ refreshToken: string }>(
          connection.refreshTokenEncrypted,
        )
      : null;

    return {
      accessToken: accessPayload.accessToken,
      refreshToken: refreshPayload?.refreshToken ?? null,
      expiresAt: null,
    };
  }

  private async exchangeGoogleCode(
    code: string,
    clientId: string,
    clientSecret: string,
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
        redirect_uri: this.googleRedirectUri(),
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

  private async exchangeMicrosoftCode(
    code: string,
    clientId: string,
    clientSecret: string,
  ): Promise<{
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  }> {
    const response = await fetch(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: this.microsoftRedirectUri(),
          grant_type: 'authorization_code',
        }),
      },
    );

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

  private async fetchMicrosoftEmail(
    accessToken: string,
  ): Promise<string | null> {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      return null;
    }

    const profile = (await response.json()) as {
      mail?: string;
      userPrincipalName?: string;
    };

    return (profile.mail ?? profile.userPrincipalName)?.toLowerCase() ?? null;
  }

  private requireGoogleClientId(): string {
    const clientId = this.config.get<string>('oauth.google.clientId');
    if (!clientId) {
      throw new BadRequestException('Google OAuth is not configured');
    }

    return clientId;
  }

  private requireMicrosoftClientId(): string {
    const clientId = this.config.get<string>('oauth.microsoft.clientId');
    if (!clientId) {
      throw new BadRequestException('Microsoft OAuth is not configured');
    }

    return clientId;
  }

  private requireZoomClientId(): string {
    const clientId = this.config.get<string>('oauth.zoom.clientId');
    if (!clientId) {
      throw new BadRequestException('Zoom OAuth is not configured');
    }

    return clientId;
  }

  private googleRedirectUri(): string {
    return `${this.backendUrl()}/calendar-connections/oauth/google/callback`;
  }

  private microsoftRedirectUri(): string {
    return `${this.backendUrl()}/calendar-connections/oauth/microsoft/callback`;
  }

  private zoomRedirectUri(): string {
    return `${this.backendUrl()}/calendar-connections/oauth/zoom/callback`;
  }

  private backendUrl(): string {
    const configured = this.config.get<string>('backendUrl');
    if (configured) {
      return configured.replace(/\/$/, '');
    }

    const port = this.config.get<number>('port') ?? 3008;
    return `http://localhost:${port}`;
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

    return payload;
  }

  private redirectSuccess(
    res: Response,
    organizationSlug: string,
    provider: CalendarConnectionProvider,
    email: string,
  ): void {
    const params = new URLSearchParams({
      calendarOAuth: 'success',
      provider,
      email,
    });

    res.redirect(
      `${this.frontendUrl()}/${organizationSlug}/crm/meetings?${params.toString()}`,
    );
  }

  private redirectError(
    res: Response,
    organizationSlug: string,
    message: string,
  ): void {
    const params = new URLSearchParams({
      calendarOAuth: 'error',
      message,
    });

    res.redirect(
      `${this.frontendUrl()}/${organizationSlug}/crm/meetings?${params.toString()}`,
    );
  }
}
