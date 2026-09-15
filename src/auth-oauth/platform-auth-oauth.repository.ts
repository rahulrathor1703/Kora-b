import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthOAuthProviderKey } from './entities/platform-auth-oauth-provider.entity';
import { PlatformAuthOAuthProviderEntity } from './entities/platform-auth-oauth-provider.entity';
import type { PlatformAuthOAuthRepositoryPort } from './platform-auth-oauth.repository.port';

@Injectable()
export class PlatformAuthOAuthRepository implements PlatformAuthOAuthRepositoryPort {
  constructor(
    @InjectRepository(PlatformAuthOAuthProviderEntity)
    private readonly providers: Repository<PlatformAuthOAuthProviderEntity>,
  ) {}

  findAll(): Promise<PlatformAuthOAuthProviderEntity[]> {
    return this.providers.find({ order: { provider: 'ASC' } });
  }

  findByProvider(
    provider: AuthOAuthProviderKey,
  ): Promise<PlatformAuthOAuthProviderEntity | null> {
    return this.providers.findOne({ where: { provider } });
  }

  save(
    provider: PlatformAuthOAuthProviderEntity,
  ): Promise<PlatformAuthOAuthProviderEntity> {
    return this.providers.save(provider);
  }
}
