import { Injectable } from '@nestjs/common';
import { CredentialsCryptoService } from '../../common/crypto/credentials-crypto.service';
import type { LocationSettingsResponse } from '../dto/location-settings.dto';
import type { OrganizationLocationSettingsEntity } from '../entities/organization-location-settings.entity';

interface StoredLocationCredentials {
  apiUsername?: string;
  apiKey?: string;
}

@Injectable()
export class LocationSettingsMapper {
  constructor(private readonly credentialsCrypto: CredentialsCryptoService) {}

  toResponse(
    entity: OrganizationLocationSettingsEntity | null,
    options: {
      platformUsername: string | null;
      decrypted?: StoredLocationCredentials | null;
    },
  ): LocationSettingsResponse {
    if (!entity) {
      const usesPlatformDefault = Boolean(options.platformUsername);

      return {
        provider: 'geonames',
        apiUrl: null,
        apiUsernameMasked: usesPlatformDefault
          ? this.credentialsCrypto.maskSecret(options.platformUsername ?? '')
          : null,
        apiKeyMasked: null,
        isConfigured: usesPlatformDefault,
        usesPlatformDefault,
      };
    }

    const credentials = options.decrypted ?? null;

    return {
      provider: entity.provider,
      apiUrl: entity.apiUrl,
      apiUsernameMasked: credentials?.apiUsername
        ? this.credentialsCrypto.maskSecret(credentials.apiUsername)
        : null,
      apiKeyMasked: credentials?.apiKey
        ? this.credentialsCrypto.maskSecret(credentials.apiKey)
        : null,
      isConfigured: this.isEntityConfigured(entity, credentials),
      usesPlatformDefault: false,
    };
  }

  decryptCredentials(
    entity: OrganizationLocationSettingsEntity | null,
  ): StoredLocationCredentials | null {
    if (!entity?.credentialsEncrypted) {
      return null;
    }

    return this.credentialsCrypto.decrypt<StoredLocationCredentials>(
      entity.credentialsEncrypted,
    );
  }

  private isEntityConfigured(
    entity: OrganizationLocationSettingsEntity,
    credentials: StoredLocationCredentials | null,
  ): boolean {
    if (entity.provider === 'custom') {
      return Boolean(entity.apiUrl?.trim());
    }

    return Boolean(credentials?.apiUsername?.trim());
  }
}

export type { StoredLocationCredentials };
