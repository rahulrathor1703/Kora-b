import type { AuthOAuthProviderKey } from './entities/platform-auth-oauth-provider.entity';
import type { PlatformAuthOAuthProviderEntity } from './entities/platform-auth-oauth-provider.entity';

export const PLATFORM_AUTH_OAUTH_REPOSITORY = Symbol(
  'PLATFORM_AUTH_OAUTH_REPOSITORY',
);

export interface PlatformAuthOAuthRepositoryPort {
  findAll(): Promise<PlatformAuthOAuthProviderEntity[]>;
  findByProvider(
    provider: AuthOAuthProviderKey,
  ): Promise<PlatformAuthOAuthProviderEntity | null>;
  save(
    provider: PlatformAuthOAuthProviderEntity,
  ): Promise<PlatformAuthOAuthProviderEntity>;
}
