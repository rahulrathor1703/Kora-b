import { Injectable } from '@nestjs/common';
import { CredentialsCryptoService } from '../../common/crypto/credentials-crypto.service';
import type { MailboxEntity } from '../entities/mailbox.entity';
import type { MailboxCredentials } from '../providers/mailbox-provider.types';

export interface MailboxConfigResponse {
  syncStatus: 'connected' | 'error' | 'pending';
  lastSyncedAt: string | null;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpSecure?: boolean;
  providerLabel?: string;
}

export interface SenderMailboxResponse {
  id: string;
  displayName: string;
  email: string;
  provider: MailboxEntity['provider'];
  status: MailboxEntity['status'];
  fromName: string;
  dailySendLimit: number;
  dailySendsUsed: number;
  warmupEnabled: boolean;
  config: MailboxConfigResponse;
  updatedAt: string;
}

export interface SenderMailboxDetailResponse extends SenderMailboxResponse {
  createdAt: string;
  updatedAt: string;
}

export interface MailboxCampaignSenderDetail {
  id: string;
  status: 'active' | 'paused' | 'stopped';
  dailySendQuota: number | null;
  sendsTodayCount: number;
  sendsTodayDate: string | null;
  signature: string | null;
}

export interface MailboxCampaignAssignment {
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  sender: MailboxCampaignSenderDetail;
  isLocking: boolean;
}

export interface MailboxCampaignsResponse {
  campaigns: MailboxCampaignAssignment[];
  activeLock: { campaignId: string; campaignName: string } | null;
}

@Injectable()
export class MailboxMapper {
  constructor(private readonly credentialsCrypto: CredentialsCryptoService) {}

  toResponse(entity: MailboxEntity): SenderMailboxResponse {
    return this.buildResponse(entity);
  }

  toDetailResponse(entity: MailboxEntity): SenderMailboxDetailResponse {
    return {
      ...this.buildResponse(entity),
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  private buildResponse(entity: MailboxEntity): SenderMailboxResponse {
    const credentials = this.safeDecryptCredentials(
      entity.credentialsEncrypted,
    );
    const config = this.buildConfig(entity, credentials);

    return {
      id: entity.id,
      displayName: entity.displayName,
      email: entity.email,
      provider: entity.provider,
      status: entity.status,
      fromName: entity.fromName,
      dailySendLimit: entity.dailySendLimit,
      dailySendsUsed: entity.dailySendsUsed,
      warmupEnabled: entity.warmupEnabled,
      config,
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  private safeDecryptCredentials(encrypted: string): MailboxCredentials | null {
    try {
      return this.credentialsCrypto.decrypt<MailboxCredentials>(encrypted);
    } catch {
      return null;
    }
  }

  private buildConfig(
    entity: MailboxEntity,
    credentials: MailboxCredentials | null,
  ): MailboxConfigResponse {
    const config: MailboxConfigResponse = {
      syncStatus: entity.syncStatus,
      lastSyncedAt: entity.lastSyncedAt?.toISOString() ?? null,
    };

    if (
      entity.provider === 'smtp' ||
      entity.provider === 'gmail' ||
      entity.provider === 'outlook'
    ) {
      if (entity.smtpHost) {
        config.smtpHost = entity.smtpHost;
      }
      if (entity.smtpPort) {
        config.smtpPort = entity.smtpPort;
      }
      if (entity.smtpUser) {
        config.smtpUser = entity.smtpUser;
      }
      if (entity.smtpSecure !== null && entity.smtpSecure !== undefined) {
        config.smtpSecure = entity.smtpSecure;
      }
    }

    if (entity.provider === 'gmail' || entity.provider === 'outlook') {
      if (
        credentials &&
        (credentials.type === 'gmail' || credentials.type === 'outlook') &&
        credentials.authMethod === 'oauth'
      ) {
        config.providerLabel =
          entity.provider === 'gmail'
            ? 'Connected with Google sign-in'
            : 'Connected with Microsoft sign-in';
      } else {
        config.providerLabel = 'Connected with app password';
      }
    }

    return config;
  }
}
