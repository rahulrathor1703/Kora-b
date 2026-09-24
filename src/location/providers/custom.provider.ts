import { BadRequestException } from '@nestjs/common';
import {
  buildLocationDisplayLabel,
  isLocationValue,
  type LocationComponent,
} from '../../common/location/location-field.types';
import type {
  LocationProviderAdapter,
  LocationSearchParams,
  LocationSearchResult,
  ResolvedLocationCredentials,
} from './location-provider.types';

interface CustomSearchResponse {
  results?: Array<Record<string, unknown>>;
}

export class CustomLocationProvider implements LocationProviderAdapter {
  async search(
    params: LocationSearchParams,
    credentials: ResolvedLocationCredentials,
  ): Promise<LocationSearchResult[]> {
    const baseUrl = credentials.customApiUrl?.trim();
    if (!baseUrl) {
      throw new BadRequestException(
        'Custom location API URL is not configured',
      );
    }

    const url = new URL(baseUrl);
    url.searchParams.set('q', params.query);
    url.searchParams.set('components', params.components.join(','));
    url.searchParams.set('trigger', params.trigger);

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (credentials.customApiKey) {
      headers.Authorization = `Bearer ${credentials.customApiKey}`;
    }

    const response = await fetch(url.toString(), { headers });
    if (!response.ok) {
      throw new BadRequestException('Custom location search request failed');
    }

    const payload = (await response.json()) as CustomSearchResponse;
    const hits = payload.results ?? [];

    return hits
      .map((hit) => this.normalizeHit(hit, params.components))
      .filter((result) => result.displayLabel.trim().length > 0);
  }

  async testConnection(
    credentials: ResolvedLocationCredentials,
  ): Promise<void> {
    const baseUrl = credentials.customApiUrl?.trim();
    if (!baseUrl) {
      throw new BadRequestException('Custom location API URL is required');
    }

    const url = new URL(baseUrl);
    url.searchParams.set('q', 'test');
    url.searchParams.set('components', 'country');
    url.searchParams.set('trigger', 'country');

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (credentials.customApiKey) {
      headers.Authorization = `Bearer ${credentials.customApiKey}`;
    }

    const response = await fetch(url.toString(), { headers });
    if (!response.ok) {
      throw new BadRequestException(
        'Custom location API connection test failed',
      );
    }
  }

  private normalizeHit(
    hit: Record<string, unknown>,
    components: LocationComponent[],
  ): LocationSearchResult {
    const valueCandidate = hit.value;
    const flatCandidate = hit;

    const value = isLocationValue(valueCandidate)
      ? valueCandidate
      : {
          city:
            typeof flatCandidate.city === 'string' ? flatCandidate.city : null,
          state:
            typeof flatCandidate.state === 'string'
              ? flatCandidate.state
              : null,
          country:
            typeof flatCandidate.country === 'string'
              ? flatCandidate.country
              : null,
          region:
            typeof flatCandidate.region === 'string'
              ? flatCandidate.region
              : null,
        };

    const result: LocationSearchResult = {
      displayLabel:
        typeof hit.displayLabel === 'string' &&
        hit.displayLabel.trim().length > 0
          ? hit.displayLabel.trim()
          : buildLocationDisplayLabel(value, components),
    };

    for (const component of components) {
      const part = value[component];
      if (part) {
        result[component] = part;
      }
    }

    return result;
  }
}
