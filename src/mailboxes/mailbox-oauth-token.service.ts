import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CredentialsCryptoService } from '../common/crypto/credentials-crypto.service';
import type { MailboxEntity } from './entities/mailbox.entity';
import { MailboxesRepository } from './mailboxes.repository';
import type {
  GmailCredentials,
  MailboxCredentials,
  OutlookCredentials,
} from './providers/mailbox-provider.types';

interface OAuthTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

@Injectable()
export class MailboxOAuthTokenService {
  constructor(
    private readonly config: ConfigService,
    private readonly credentialsCrypto: CredentialsCryptoService,
    private readonly mailboxesRepository: MailboxesRepository,
  ) {}

  isOAuthCredentials(
    credentials: MailboxCredentials,
  ): credentials is GmailCredentials | OutlookCredentials {
    return (
      (credentials.type === 'gmail' || credentials.type === 'outlook') &&
      credentials.authMethod === 'oauth'
    );
  }

  async ensureFreshOAuthCredentials(
    mailbox: MailboxEntity,
    credentials: GmailCredentials | OutlookCredentials,
  ): Promise<GmailCredentials | OutlookCredentials> {
    const refreshToken = credentials.refreshToken?.trim();

    if (!refreshToken) {
      throw new BadRequestException(
        'OAuth mailbox is missing a refresh token — reconnect the mailbox',
      );
    }

    const expiresAt = credentials.expiresAt ?? 0;
    const accessToken = credentials.accessToken?.trim();

    if (accessToken && expiresAt > Date.now() + 60_000) {
      return credentials;
    }

    const refreshed =
      credentials.type === 'gmail'
        ? await this.refreshGmailToken(refreshToken)
        : await this.refreshOutlookToken(refreshToken);

    const updatedCredentials = {
      ...credentials,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? refreshToken,
      expiresAt: refreshed.expiresAt,
    };

    mailbox.credentialsEncrypted =
      this.credentialsCrypto.encrypt(updatedCredentials);
    await this.mailboxesRepository.save(mailbox);

    return updatedCredentials;
  }

  async getFreshAccessToken(
    mailbox: MailboxEntity,
    credentials: GmailCredentials | OutlookCredentials,
  ): Promise<string> {
    const fresh = await this.ensureFreshOAuthCredentials(mailbox, credentials);
    const accessToken = fresh.accessToken?.trim();

    if (!accessToken) {
      throw new InternalServerErrorException(
        'OAuth mailbox has no access token after refresh',
      );
    }

    return accessToken;
  }

  private async refreshGmailToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt: number | null;
  }> {
    const clientId = this.config.get<string>('oauth.google.clientId') ?? '';
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
      throw new BadRequestException(
        'Failed to refresh Google OAuth token — reconnect the mailbox',
      );
    }

    const tokens = (await response.json()) as OAuthTokenResponse;

    if (!tokens.access_token) {
      throw new BadRequestException(
        'Google OAuth token refresh returned no access token',
      );
    }

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt:
        typeof tokens.expires_in === 'number'
          ? Date.now() + tokens.expires_in * 1000
          : null,
    };
  }

  private async refreshOutlookToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt: number | null;
  }> {
    const clientId = this.config.get<string>('oauth.microsoft.clientId') ?? '';
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
      throw new BadRequestException(
        'Failed to refresh Microsoft OAuth token — reconnect the mailbox',
      );
    }

    const tokens = (await response.json()) as OAuthTokenResponse;

    if (!tokens.access_token) {
      throw new BadRequestException(
        'Microsoft OAuth token refresh returned no access token',
      );
    }

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt:
        typeof tokens.expires_in === 'number'
          ? Date.now() + tokens.expires_in * 1000
          : null,
    };
  }
}
