import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthOAuthProviderKey } from './entities/platform-auth-oauth-provider.entity';
import type { PlatformAuthOAuthProviderEntity } from './entities/platform-auth-oauth-provider.entity';
import {
  PLATFORM_AUTH_OAUTH_REPOSITORY,
  type PlatformAuthOAuthRepositoryPort,
} from './platform-auth-oauth.repository.port';

export interface AuthOAuthProviderConfig {
  enabled: boolean;
  clientId: string | null;
}

export interface AuthOAuthPublicConfig {
  google: AuthOAuthProviderConfig;
  apple: AuthOAuthProviderConfig;
}

export interface PlatformAuthOAuthProviderView {
  provider: AuthOAuthProviderKey;
  enabled: boolean;
  clientId: string | null;
  updatedAt: string;
}

@Injectable()
export class PlatformAuthOAuthService {
  constructor(
    @Inject(PLATFORM_AUTH_OAUTH_REPOSITORY)
    private readonly repository: PlatformAuthOAuthRepositoryPort,
  ) {}

  async getPublicConfig(): Promise<AuthOAuthPublicConfig> {
    const providers = await this.repository.findAll();
    return this.toPublicConfig(providers);
  }

  async listProviders(): Promise<PlatformAuthOAuthProviderView[]> {
    const providers = await this.repository.findAll();
    return providers.map((provider) => this.toView(provider));
  }

  async getEnabledClientId(provider: AuthOAuthProviderKey): Promise<string> {
    const record = await this.repository.findByProvider(provider);

    if (!record?.enabled || !record.clientId?.trim()) {
      throw new BadRequestException(
        `${provider === 'google' ? 'Google' : 'Apple'} sign-in is not configured`,
      );
    }

    return record.clientId.trim();
  }

  async updateProvider(
    provider: AuthOAuthProviderKey,
    input: { enabled?: boolean; clientId?: string | null },
  ): Promise<PlatformAuthOAuthProviderView> {
    const record = await this.repository.findByProvider(provider);

    if (!record) {
      throw new NotFoundException('OAuth provider not found');
    }

    if (input.enabled !== undefined) {
      record.enabled = input.enabled;
    }

    if (input.clientId !== undefined) {
      const trimmed = input.clientId?.trim() ?? '';
      record.clientId = trimmed.length > 0 ? trimmed : null;
    }

    if (record.enabled && !record.clientId) {
      throw new BadRequestException(
        'Client ID is required when the provider is enabled',
      );
    }

    const saved = await this.repository.save(record);
    return this.toView(saved);
  }

  private toPublicConfig(
    providers: PlatformAuthOAuthProviderEntity[],
  ): AuthOAuthPublicConfig {
    const google = providers.find((item) => item.provider === 'google');
    const apple = providers.find((item) => item.provider === 'apple');

    return {
      google: this.toPublicProvider(google),
      apple: this.toPublicProvider(apple),
    };
  }

  private toPublicProvider(
    provider: PlatformAuthOAuthProviderEntity | undefined,
  ): AuthOAuthProviderConfig {
    if (!provider?.enabled || !provider.clientId) {
      return { enabled: false, clientId: null };
    }

    return {
      enabled: true,
      clientId: provider.clientId,
    };
  }

  private toView(
    provider: PlatformAuthOAuthProviderEntity,
  ): PlatformAuthOAuthProviderView {
    return {
      provider: provider.provider,
      enabled: provider.enabled,
      clientId: provider.clientId,
      updatedAt: provider.updatedAt.toISOString(),
    };
  }
}
