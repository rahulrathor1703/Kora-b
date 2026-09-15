import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  normalizeLocationComponents,
  type LocationComponent,
} from '../common/location/location-field.types';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import type { LocationSearchQueryDto } from './dto/location-search.dto';
import { LocationSettingsService } from './location-settings.service';
import { LocationProviderRegistry } from './providers/location-provider.registry';
import type { LocationSearchResult } from './providers/location-provider.types';

interface CacheEntry {
  expiresAt: number;
  results: LocationSearchResult[];
}

@Injectable()
export class LocationSearchService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs = 60_000;

  constructor(
    private readonly locationSettingsService: LocationSettingsService,
    private readonly providerRegistry: LocationProviderRegistry,
  ) {}

  async search(
    query: LocationSearchQueryDto,
    organizationId: string | null,
  ): Promise<LocationSearchResult[]> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const components = normalizeLocationComponents(query.components);

    if (components.length === 0) {
      throw new BadRequestException(
        'At least one location component is required',
      );
    }

    if (!components.includes(query.trigger)) {
      throw new BadRequestException(
        'Search trigger must be one of the requested components',
      );
    }

    const cacheKey = [
      resolvedOrganizationId,
      query.q.trim().toLowerCase(),
      components.join(','),
      query.trigger,
    ].join(':');

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.results;
    }

    let credentials;
    try {
      credentials = await this.locationSettingsService.resolveCredentials(
        resolvedOrganizationId,
      );
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      throw new ServiceUnavailableException(
        'Location API is not configured. Add location API settings in CRM configuration.',
      );
    }

    const results = await this.providerRegistry.resolve(credentials).search(
      {
        query: query.q.trim(),
        components,
        trigger: query.trigger,
      },
      credentials,
    );

    this.cache.set(cacheKey, {
      results,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    return results;
  }

  async getStatus(
    organizationId: string | null,
  ): Promise<{ isConfigured: boolean }> {
    const settings =
      await this.locationSettingsService.getSettings(organizationId);

    return { isConfigured: settings.isConfigured };
  }
}

export type { LocationComponent };
