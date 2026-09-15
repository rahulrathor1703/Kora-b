import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { CredentialsCryptoService } from '../common/crypto/credentials-crypto.service';
import type { MailboxEntity } from './entities/mailbox.entity';
import { MailboxDailyLimitReachedError } from './mailbox-daily-limit-reached.error';
import { applyMailboxDailyReset } from './mailbox-daily.util';
import { MailboxOAuthTokenService } from './mailbox-oauth-token.service';
import type {
  GmailCredentials,
  MailboxCredentials,
  OutlookCredentials,
} from './providers/mailbox-provider.types';
import { MARKOS_TRACKING_TOKEN_HEADER } from '../email-campaigns/campaign-correlation.util';
import { MailboxesRepository } from './mailboxes.repository';
import { fetchOutlookSentMessageId } from './mailbox-send-outlook.util';

export interface MailboxCampaignEmailPayload {
  mailboxId: string;
  organizationId: string;
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  trackingToken?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

export interface MailboxCampaignEmailResult {
  messageId: string | null;
}

export interface MailboxTestEmailPayload {
  mailboxId: string;
  organizationId: string;
  fromName: string;
  fromEmail: string;
  to: string;
}

@Injectable()
export class MailboxSendService {
  constructor(
    private readonly mailboxesRepository: MailboxesRepository,
    private readonly credentialsCrypto: CredentialsCryptoService,
    private readonly oauthTokenService: MailboxOAuthTokenService,
    private readonly configService: ConfigService,
  ) {}

  async sendCampaignEmail(
    payload: MailboxCampaignEmailPayload,
  ): Promise<MailboxCampaignEmailResult> {
    const mailbox = await this.mailboxesRepository.findByIdAndOrganizationId(
      payload.mailboxId,
      payload.organizationId,
    );

    if (!mailbox) {
      throw new BadRequestException('Mailbox not found for campaign send');
    }

    if (mailbox.status !== 'active') {
      throw new BadRequestException('Mailbox is inactive');
    }

    applyMailboxDailyReset(mailbox, new Date());

    if (mailbox.dailySendsUsed >= mailbox.dailySendLimit) {
      throw new MailboxDailyLimitReachedError();
    }

    const credentials = this.credentialsCrypto.decrypt<MailboxCredentials>(
      mailbox.credentialsEncrypted,
    );

    const sendResult = this.oauthTokenService.isOAuthCredentials(credentials)
      ? await this.sendViaOAuth(mailbox, credentials, payload)
      : await this.sendViaSmtp(mailbox, credentials, payload);

    mailbox.dailySendsUsed += 1;
    await this.mailboxesRepository.save(mailbox);

    return sendResult;
  }

  async sendTestEmail(
    payload: MailboxTestEmailPayload,
  ): Promise<MailboxCampaignEmailResult> {
    const mailbox = await this.mailboxesRepository.findByIdAndOrganizationId(
      payload.mailboxId,
      payload.organizationId,
    );

    if (!mailbox) {
      throw new BadRequestException('Mailbox not found');
    }

    const credentials = this.credentialsCrypto.decrypt<MailboxCredentials>(
      mailbox.credentialsEncrypted,
    );

    const testPayload: MailboxCampaignEmailPayload = {
      mailboxId: payload.mailboxId,
      organizationId: payload.organizationId,
      fromName: payload.fromName,
      fromEmail: payload.fromEmail,
      to: payload.to,
      subject: 'Markos mailbox connection test',
      html: `<p>This is a test email sent from <strong>${payload.fromEmail}</strong> to verify your mailbox connection is working.</p>`,
      text: `This is a test email sent from ${payload.fromEmail} to verify your mailbox connection is working.`,
    };

    return this.oauthTokenService.isOAuthCredentials(credentials)
      ? await this.sendViaOAuth(mailbox, credentials, testPayload)
      : await this.sendViaSmtp(mailbox, credentials, testPayload);
  }

  private async sendViaSmtp(
    mailbox: MailboxEntity,
    credentials: MailboxCredentials,
    payload: MailboxCampaignEmailPayload,
  ): Promise<MailboxCampaignEmailResult> {
    const password = credentials.password;

    if (!password) {
      throw new InternalServerErrorException(
        'Mailbox credentials are missing a send password',
      );
    }

    if (!mailbox.smtpHost || !mailbox.smtpPort || !mailbox.smtpUser) {
      throw new InternalServerErrorException(
        'Mailbox SMTP settings are incomplete',
      );
    }

    const transporter = nodemailer.createTransport({
      host: mailbox.smtpHost,
      port: mailbox.smtpPort,
      secure: mailbox.smtpSecure ?? false,
      auth: {
        user: mailbox.smtpUser,
        pass: password,
      },
    });

    const sendResult: unknown = await transporter.sendMail({
      from: `"${payload.fromName}" <${payload.fromEmail}>`,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      headers: buildTrackingHeaders(payload.trackingToken),
      attachments: payload.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
      })),
    });

    return {
      messageId: extractProviderMessageId(sendResult),
    };
  }

  private async sendViaOAuth(
    mailbox: MailboxEntity,
    credentials: GmailCredentials | OutlookCredentials,
    payload: MailboxCampaignEmailPayload,
  ): Promise<MailboxCampaignEmailResult> {
    const freshCredentials =
      await this.oauthTokenService.ensureFreshOAuthCredentials(
        mailbox,
        credentials,
      );

    if (freshCredentials.type === 'gmail') {
      return this.sendViaGmailOAuth(mailbox, freshCredentials, payload);
    }

    return this.sendViaOutlookGraph(mailbox, freshCredentials, payload);
  }

  private async sendViaGmailOAuth(
    mailbox: MailboxEntity,
    credentials: GmailCredentials,
    payload: MailboxCampaignEmailPayload,
  ): Promise<MailboxCampaignEmailResult> {
    const clientId =
      this.configService.get<string>('oauth.google.clientId') ?? '';
    const clientSecret =
      this.configService.get<string>('oauth.google.clientSecret') ?? '';
    const accessToken = credentials.accessToken?.trim();
    const refreshToken = credentials.refreshToken?.trim();

    if (!accessToken || !refreshToken) {
      throw new BadRequestException(
        'OAuth Gmail mailbox is missing tokens — reconnect the mailbox',
      );
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: mailbox.email,
        clientId,
        clientSecret,
        refreshToken,
        accessToken,
      },
    });

    const sendResult: unknown = await transporter.sendMail({
      from: `"${payload.fromName}" <${payload.fromEmail}>`,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      headers: buildTrackingHeaders(payload.trackingToken),
      attachments: payload.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
      })),
    });

    return {
      messageId: extractProviderMessageId(sendResult),
    };
  }

  private async sendViaOutlookGraph(
    mailbox: MailboxEntity,
    credentials: OutlookCredentials,
    payload: MailboxCampaignEmailPayload,
  ): Promise<MailboxCampaignEmailResult> {
    const accessToken = await this.oauthTokenService.getFreshAccessToken(
      mailbox,
      credentials,
    );

    const attachments =
      payload.attachments?.map((attachment) => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: attachment.filename,
        contentType: attachment.contentType,
        contentBytes: attachment.content.toString('base64'),
      })) ?? [];

    const response = await fetch(
      'https://graph.microsoft.com/v1.0/me/sendMail',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject: payload.subject,
            body: {
              contentType: 'HTML',
              content: payload.html,
            },
            toRecipients: [
              {
                emailAddress: {
                  address: payload.to,
                },
              },
            ],
            from: {
              emailAddress: {
                address: payload.fromEmail,
                name: payload.fromName,
              },
            },
            internetMessageHeaders: buildOutlookTrackingHeaders(
              payload.trackingToken,
            ),
            attachments,
          },
          saveToSentItems: true,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new BadRequestException(
        `Microsoft Graph send failed: ${errorText.slice(0, 200)}`,
      );
    }

    const messageId = await fetchOutlookSentMessageId(
      accessToken,
      payload.to,
      payload.subject,
    );

    return { messageId };
  }
}

function buildTrackingHeaders(
  trackingToken?: string,
): Record<string, string> | undefined {
  if (!trackingToken) {
    return undefined;
  }

  return {
    [MARKOS_TRACKING_TOKEN_HEADER]: trackingToken,
  };
}

function buildOutlookTrackingHeaders(
  trackingToken?: string,
): Array<{ name: string; value: string }> {
  if (!trackingToken) {
    return [];
  }

  return [{ name: MARKOS_TRACKING_TOKEN_HEADER, value: trackingToken }];
}

function extractProviderMessageId(result: unknown): string | null {
  if (
    typeof result !== 'object' ||
    result === null ||
    !('messageId' in result)
  ) {
    return null;
  }

  const messageId = (result as { messageId?: unknown }).messageId;

  return typeof messageId === 'string' ? messageId : null;
}
