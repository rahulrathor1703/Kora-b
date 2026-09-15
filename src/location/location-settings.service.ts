import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CredentialsCryptoService } from '../common/crypto/credentials-crypto.service';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import type {
  LocationSettingsResponse,
  TestLocationSettingsDto,
  UpdateLocationSettingsDto,
} from './dto/location-settings.dto';
import type { LocationProvider } from './entities/organization-location-settings.entity';
import {
  LocationSettingsMapper,
  type StoredLocationCredentials,
} from './mappers/location-settings.mapper';
import { LocationSettingsRepository } from './location-settings.repository';
import { LocationProviderRegistry } from './providers/location-provider.registry';
import type { ResolvedLocationCredentials } from './providers/location-provider.types';

@Injectable()
export class LocationSettingsService {
  constructor(
    private readonly locationSettingsRepository: LocationSettingsRepository,
    private readonly credentialsCrypto: CredentialsCryptoService,
    private readonly locationSettingsMapper: LocationSettingsMapper,
    private readonly providerRegistry: LocationProviderRegistry,
    private readonly config: ConfigService,
  ) {}

  async getSettings(
    organizationId: string | null,
  ): Promise<LocationSettingsResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const entity = await this.locationSettingsRepository.findByOrganizationId(
      resolvedOrganizationId,
    );
    const decrypted = this.locationSettingsMapper.decryptCredentials(entity);

    return this.locationSettingsMapper.toResponse(entity, {
      platformUsername: this.getPlatformGeonamesUsername(),
      decrypted,
    });
  }

  async updateSettings(
    dto: UpdateLocationSettingsDto,
    organizationId: string | null,
  ): Promise<LocationSettingsResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const existing = await this.locationSettingsRepository.findByOrganizationId(
      resolvedOrganizationId,
    );
    const currentCredentials =
      this.locationSettingsMapper.decryptCredentials(existing) ?? {};

    const nextCredentials = this.buildNextCredentials(dto, currentCredentials);

    this.validateProviderInput(dto.provider, dto, nextCredentials);

    const credentials = this.resolveCredentialsForTest(
      dto.provider,
      nextCredentials,
      dto.apiUrl ?? existing?.apiUrl ?? null,
    );

    await this.providerRegistry
      .resolve(credentials)
      .testConnection(credentials);

    const entity =
      existing ??
      this.locationSettingsRepository.create(resolvedOrganizationId);
    entity.provider = dto.provider;
    entity.apiUrl =
      dto.provider === 'custom' ? (dto.apiUrl?.trim() ?? null) : null;
    entity.credentialsEncrypted = this.hasStoredCredentials(nextCredentials)
      ? this.credentialsCrypto.encrypt(nextCredentials)
      : null;

    const saved = await this.locationSettingsRepository.save(entity);

    return this.locationSettingsMapper.toResponse(saved, {
      platformUsername: this.getPlatformGeonamesUsername(),
      decrypted: nextCredentials,
    });
  }

  async testSettings(
    dto: TestLocationSettingsDto,
    organizationId: string | null,
  ): Promise<{ ok: true }> {
    requireOrganizationId(organizationId);

    const credentials = this.resolveCredentialsForTest(
      dto.provider,
      {
        apiUsername: dto.apiUsername?.trim(),
        apiKey: dto.apiKey?.trim(),
      },
      dto.apiUrl?.trim() ?? null,
    );

    this.validateProviderInput(dto.provider, dto, credentials);

    await this.providerRegistry
      .resolve(credentials)
      .testConnection(credentials);

    return { ok: true };
  }

  async resolveCredentials(
    organizationId: string,
  ): Promise<ResolvedLocationCredentials> {
    const entity =
      await this.locationSettingsRepository.findByOrganizationId(
        organizationId,
      );
    const stored = this.locationSettingsMapper.decryptCredentials(entity);

    if (entity?.provider === 'custom') {
      if (!entity.apiUrl?.trim()) {
        throw new ServiceUnavailableException(
          'Location API is not configured. Add a custom API URL in CRM configuration.',
        );
      }

      return {
        provider: 'custom',
        customApiUrl: entity.apiUrl.trim(),
        customApiKey: stored?.apiKey?.trim(),
      };
    }

    const geonamesUsername =
      stored?.apiUsername?.trim() ?? this.getPlatformGeonamesUsername();

    if (!geonamesUsername) {
      throw new ServiceUnavailableException(
        'Location API is not configured. Add a GeoNames username in CRM configuration.',
      );
    }

    return {
      provider: 'geonames',
      geonamesUsername,
    };
  }

  private buildNextCredentials(
    dto: UpdateLocationSettingsDto,
    current: StoredLocationCredentials,
  ): StoredLocationCredentials {
    const next: StoredLocationCredentials = { ...current };

    if (dto.apiUsername !== undefined) {
      next.apiUsername = dto.apiUsername.trim();
    }

    if (dto.apiKey !== undefined) {
      next.apiKey = dto.apiKey.trim();
    }

    return next;
  }

  private validateProviderInput(
    provider: LocationProvider,
    dto: UpdateLocationSettingsDto | TestLocationSettingsDto,
    credentials: StoredLocationCredentials | ResolvedLocationCredentials,
  ): void {
    if (provider === 'custom') {
      const apiUrl = 'apiUrl' in dto ? dto.apiUrl?.trim() : undefined;
      const resolvedUrl =
        apiUrl ??
        ('customApiUrl' in credentials ? credentials.customApiUrl : undefined);

      if (!resolvedUrl) {
        throw new BadRequestException('Custom location API URL is required');
      }

      return;
    }

    const username = this.resolveGeonamesUsername(credentials);

    if (!username && !this.getPlatformGeonamesUsername()) {
      throw new BadRequestException('GeoNames username is required');
    }
  }

  private resolveGeonamesUsername(
    credentials: StoredLocationCredentials | ResolvedLocationCredentials,
  ): string | undefined {
    const stored = credentials as StoredLocationCredentials;
    const resolved = credentials as ResolvedLocationCredentials;
    const username = stored.apiUsername ?? resolved.geonamesUsername;

    return username?.trim();
  }

  private resolveCredentialsForTest(
    provider: LocationProvider,
    credentials: StoredLocationCredentials,
    apiUrl: string | null,
  ): ResolvedLocationCredentials {
    if (provider === 'custom') {
      return {
        provider: 'custom',
        customApiUrl: apiUrl?.trim() ?? undefined,
        customApiKey: credentials.apiKey?.trim(),
      };
    }

    return {
      provider: 'geonames',
      geonamesUsername:
        credentials.apiUsername?.trim() ??
        this.getPlatformGeonamesUsername() ??
        undefined,
    };
  }

  private hasStoredCredentials(
    credentials: StoredLocationCredentials,
  ): boolean {
    return Boolean(
      credentials.apiUsername?.trim() || credentials.apiKey?.trim(),
    );
  }

  private getPlatformGeonamesUsername(): string | null {
    const username = this.config.get<string>('location.geonamesUsername');
    return username?.trim() ? username.trim() : null;
  }
}
