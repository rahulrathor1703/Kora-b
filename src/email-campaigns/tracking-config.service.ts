import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CredentialsCryptoService } from '../common/crypto/credentials-crypto.service';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import { MailboxesRepository } from '../mailboxes/mailboxes.repository';
import type { MailboxCredentials } from '../mailboxes/providers/mailbox-provider.types';
import { canMonitorMailbox } from './bounce-monitor/imap-mailbox.client';
import { EmailCampaignMessagesRepository } from './email-campaign-messages.repository';
import { EmailCampaignsRepository } from './email-campaigns.repository';
import {
  buildRecommendedTrackingBaseUrl,
  formatTrackingBaseUrlForDisplay,
  isTrackingBaseUrlPubliclyReachable,
  probeTrackingOpenEndpoint,
} from './tracking-config.util';

export interface CampaignTrackingStatusResponse {
  trackingBaseUrl: string;
  recommendedTrackingBaseUrl: string;
  isPubliclyReachable: boolean;
  trackingEndpointVerified: boolean;
  trackingEndpointError: string | null;
  bounceMonitoringEnabled: boolean;
  oauthSendSupported: boolean;
  mailboxesNeedingReauth: string[];
}

export interface CampaignTrackingHealthResponse extends CampaignTrackingStatusResponse {
  messagesMissingProviderMessageId: number;
  mailboxes: Array<{
    id: string;
    email: string;
    lastSyncedAt: string | null;
    syncStatus: string | null;
    monitoringEnabled: boolean;
  }>;
}

@Injectable()
export class TrackingConfigService {
  constructor(
    private readonly configService: ConfigService,
    private readonly mailboxesRepository: MailboxesRepository,
    private readonly credentialsCrypto: CredentialsCryptoService,
    private readonly emailCampaignsRepository: EmailCampaignsRepository,
    private readonly messagesRepository: EmailCampaignMessagesRepository,
  ) {}

  async getTrackingStatusForOrganization(
    organizationId: string | null,
  ): Promise<CampaignTrackingStatusResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const trackingBaseUrl = this.configService.get<string>(
      'trackingBaseUrl',
      'http://localhost:3008',
    );
    const frontendUrl = this.configService.get<string>('frontendUrl');
    const backendUrl = this.configService.get<string>('backendUrl');

    const mailboxes = await this.mailboxesRepository.findAllByOrganizationId(
      resolvedOrganizationId,
    );

    let bounceMonitoringEnabled = false;
    const mailboxesNeedingReauth: string[] = [];

    for (const mailbox of mailboxes) {
      if (mailbox.status !== 'active') {
        continue;
      }

      try {
        const credentials = this.credentialsCrypto.decrypt<MailboxCredentials>(
          mailbox.credentialsEncrypted,
        );

        if (canMonitorMailbox(mailbox, credentials)) {
          bounceMonitoringEnabled = true;
        }

        if (
          (credentials.type === 'gmail' || credentials.type === 'outlook') &&
          credentials.authMethod === 'oauth' &&
          !credentials.refreshToken?.trim()
        ) {
          mailboxesNeedingReauth.push(mailbox.email);
        }
      } catch {
        continue;
      }
    }

    const port = this.configService.get<number>('port', 3008);
    const probeResult = await probeTrackingOpenEndpoint(trackingBaseUrl, {
      localFallbackPort: port,
    });
    const recommendedTrackingBaseUrl =
      probeResult.suggestedTrackingBaseUrl ??
      buildRecommendedTrackingBaseUrl(trackingBaseUrl, frontendUrl, backendUrl);
    const configuredBase = trackingBaseUrl.trim().replace(/\/$/, '');
    const endpointVerified =
      probeResult.verified && !probeResult.suggestedTrackingBaseUrl;

    return {
      trackingBaseUrl: formatTrackingBaseUrlForDisplay(trackingBaseUrl),
      recommendedTrackingBaseUrl,
      isPubliclyReachable: isTrackingBaseUrlPubliclyReachable(trackingBaseUrl),
      trackingEndpointVerified: endpointVerified,
      trackingEndpointError: endpointVerified
        ? null
        : probeResult.suggestedTrackingBaseUrl
          ? `TRACKING_BASE_URL must include /api (currently ${configuredBase}). Set TRACKING_BASE_URL=${probeResult.suggestedTrackingBaseUrl} and restart the backend.`
          : [
              probeResult.error,
              `Set TRACKING_BASE_URL=${recommendedTrackingBaseUrl}`,
            ]
              .filter(Boolean)
              .join(' '),
      bounceMonitoringEnabled,
      oauthSendSupported: true,
      mailboxesNeedingReauth,
    };
  }

  async getCampaignTrackingHealth(
    campaignId: string,
    organizationId: string | null,
  ): Promise<CampaignTrackingHealthResponse> {
    const orgId = requireOrganizationId(organizationId);
    const campaign =
      await this.emailCampaignsRepository.findByIdAndOrganizationId(
        campaignId,
        orgId,
      );

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const baseStatus = await this.getTrackingStatusForOrganization(orgId);
    const messagesMissingProviderMessageId =
      await this.messagesRepository.countMissingProviderMessageIdByCampaignId(
        campaignId,
      );

    const mailboxes =
      await this.mailboxesRepository.findAllByOrganizationId(orgId);
    const mailboxHealth = [];

    for (const mailbox of mailboxes) {
      let monitoringEnabled = false;

      if (mailbox.status === 'active') {
        try {
          const credentials =
            this.credentialsCrypto.decrypt<MailboxCredentials>(
              mailbox.credentialsEncrypted,
            );
          monitoringEnabled = canMonitorMailbox(mailbox, credentials);
        } catch {
          monitoringEnabled = false;
        }
      }

      mailboxHealth.push({
        id: mailbox.id,
        email: mailbox.email,
        lastSyncedAt: mailbox.lastSyncedAt?.toISOString() ?? null,
        syncStatus: mailbox.syncStatus,
        monitoringEnabled,
      });
    }

    return {
      ...baseStatus,
      messagesMissingProviderMessageId,
      mailboxes: mailboxHealth,
    };
  }
}
