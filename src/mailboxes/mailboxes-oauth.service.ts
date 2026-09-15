import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { Response } from 'express';
import { OAuthSessionStore } from './oauth-session.store';

interface OAuthStatePayload {
  organizationId: string;
  organizationSlug: string;
  userId: string;
  provider: 'gmail' | 'outlook';
  nonce: string;
  expiresAt: number;
}

@Injectable()
export class MailboxesOAuthService {
  private readonly stateTtlMs = 10 * 60 * 1000;

  constructor(
    private readonly config: ConfigService,
    private readonly oauthSessionStore: OAuthSessionStore,
  ) {}

  getAvailability(): { google: boolean; microsoft: boolean } {
    return {
      google: Boolean(this.config.get<string>('oauth.google.clientId')),
      microsoft: Boolean(this.config.get<string>('oauth.microsoft.clientId')),
    };
  }

  buildGoogleAuthorizeUrl(input: {
    organizationId: string;
    organizationSlug: string;
    userId: string;
  }): string {
    const clientId = this.config.get<string>('oauth.google.clientId');
    if (!clientId) {
      throw new BadRequestException(
        'Google OAuth is not configured on the server',
      );
    }

    const state = this.signState({
      organizationId: input.organizationId,
      organizationSlug: input.organizationSlug,
      userId: input.userId,
      provider: 'gmail',
      nonce: randomBytes(16).toString('hex'),
      expiresAt: Date.now() + this.stateTtlMs,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.googleRedirectUri(),
      response_type: 'code',
      scope: [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
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
    organizationId: string;
    organizationSlug: string;
    userId: string;
  }): string {
    const clientId = this.config.get<string>('oauth.microsoft.clientId');
    if (!clientId) {
      throw new BadRequestException(
        'Microsoft OAuth is not configured on the server',
      );
    }

    const state = this.signState({
      organizationId: input.organizationId,
      organizationSlug: input.organizationSlug,
      userId: input.userId,
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
        'https://graph.microsoft.com/Mail.Send',
        'https://graph.microsoft.com/Mail.Read',
        'https://graph.microsoft.com/User.Read',
      ].join(' '),
      state,
    });

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async handleGoogleCallback(
    code: string,
    state: string,
    res: Response,
  ): Promise<void> {
    const payload = this.verifyState(state);
    if (payload.provider !== 'gmail') {
      throw new BadRequestException('OAuth provider mismatch');
    }

    const clientId = this.config.get<string>('oauth.google.clientId') ?? '';
    const clientSecret =
      this.config.get<string>('oauth.google.clientSecret') ?? '';

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
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

    if (!tokenResponse.ok) {
      this.redirectError(
        res,
        payload.organizationSlug,
        'Google sign-in failed',
      );
      return;
    }

    const tokens = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!tokens.access_token) {
      this.redirectError(
        res,
        payload.organizationSlug,
        'Google sign-in failed',
      );
      return;
    }

    const profileResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { authorization: `Bearer ${tokens.access_token}` },
      },
    );

    if (!profileResponse.ok) {
      this.redirectError(
        res,
        payload.organizationSlug,
        'Could not read Google account email',
      );
      return;
    }

    const profile = (await profileResponse.json()) as { email?: string };
    if (!profile.email) {
      this.redirectError(
        res,
        payload.organizationSlug,
        'Google account has no email address',
      );
      return;
    }

    const oauthToken = this.oauthSessionStore.create({
      provider: 'gmail',
      email: profile.email.toLowerCase(),
      organizationId: payload.organizationId,
      userId: payload.userId,
      credentials: {
        type: 'gmail',
        password: '',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? '',
        expiresAt:
          typeof tokens.expires_in === 'number'
            ? Date.now() + tokens.expires_in * 1000
            : null,
        authMethod: 'oauth',
      },
    });

    this.redirectSuccess(res, payload.organizationSlug, {
      provider: 'gmail',
      email: profile.email.toLowerCase(),
      oauthToken,
    });
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

    const clientId = this.config.get<string>('oauth.microsoft.clientId') ?? '';
    const clientSecret =
      this.config.get<string>('oauth.microsoft.clientSecret') ?? '';

    const tokenResponse = await fetch(
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

    if (!tokenResponse.ok) {
      this.redirectError(
        res,
        payload.organizationSlug,
        'Microsoft sign-in failed',
      );
      return;
    }

    const tokens = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!tokens.access_token) {
      this.redirectError(
        res,
        payload.organizationSlug,
        'Microsoft sign-in failed',
      );
      return;
    }

    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    });

    if (!profileResponse.ok) {
      this.redirectError(
        res,
        payload.organizationSlug,
        'Could not read Microsoft account email',
      );
      return;
    }

    const profile = (await profileResponse.json()) as {
      mail?: string;
      userPrincipalName?: string;
    };

    const email = (profile.mail ?? profile.userPrincipalName)?.toLowerCase();
    if (!email) {
      this.redirectError(
        res,
        payload.organizationSlug,
        'Microsoft account has no email address',
      );
      return;
    }

    const oauthToken = this.oauthSessionStore.create({
      provider: 'outlook',
      email,
      organizationId: payload.organizationId,
      userId: payload.userId,
      credentials: {
        type: 'outlook',
        password: '',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? '',
        expiresAt:
          typeof tokens.expires_in === 'number'
            ? Date.now() + tokens.expires_in * 1000
            : null,
        authMethod: 'oauth',
      },
    });

    this.redirectSuccess(res, payload.organizationSlug, {
      provider: 'outlook',
      email,
      oauthToken,
    });
  }

  private googleRedirectUri(): string {
    return `${this.backendUrl()}/mailboxes/oauth/google/callback`;
  }

  private microsoftRedirectUri(): string {
    return `${this.backendUrl()}/mailboxes/oauth/microsoft/callback`;
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
    input: {
      provider: 'gmail' | 'outlook';
      email: string;
      oauthToken: string;
    },
  ): void {
    const params = new URLSearchParams({
      oauth: 'success',
      provider: input.provider,
      email: input.email,
      oauthToken: input.oauthToken,
    });

    res.redirect(
      `${this.frontendUrl()}/${organizationSlug}/email/mailboxes?${params.toString()}`,
    );
  }

  private redirectError(
    res: Response,
    organizationSlug: string,
    message: string,
  ): void {
    const params = new URLSearchParams({
      oauth: 'error',
      message,
    });

    res.redirect(
      `${this.frontendUrl()}/${organizationSlug}/email/mailboxes?${params.toString()}`,
    );
  }
}
