import { BadRequestException } from '@nestjs/common';
import {
  buildLocationDisplayLabel,
  CONTINENT_NAMES,
  type LocationComponent,
  type LocationValue,
} from '../../common/location/location-field.types';
import type {
  LocationProviderAdapter,
  LocationSearchParams,
  LocationSearchResult,
  ResolvedLocationCredentials,
} from './location-provider.types';

interface GeoNamesSearchHit {
  name?: string;
  adminName1?: string;
  countryName?: string;
  countryCode?: string;
  fcode?: string;
  fcl?: string;
}

interface GeoNamesSearchResponse {
  geonames?: GeoNamesSearchHit[];
}

interface GeoNamesCountryInfoResponse {
  geonames?: Array<{ continent?: string; countryName?: string }>;
}

const GEONAMES_BASE_URL = 'http://api.geonames.org';

export class GeonamesLocationProvider implements LocationProviderAdapter {
  async search(
    params: LocationSearchParams,
    credentials: ResolvedLocationCredentials,
  ): Promise<LocationSearchResult[]> {
    const username = credentials.geonamesUsername;
    if (!username) {
      throw new BadRequestException('GeoNames username is not configured');
    }

    const searchParams = new URLSearchParams({
      q: params.query,
      maxRows: '10',
      username,
      style: 'FULL',
    });

    switch (params.trigger) {
      case 'city':
        searchParams.set('featureClass', 'P');
        break;
      case 'state':
        searchParams.set('featureCode', 'ADM1');
        break;
      case 'country':
        searchParams.set('featureCode', 'PCLI');
        break;
      case 'region':
        searchParams.set('featureCode', 'PCLI');
        break;
      default:
        break;
    }

    const response = await fetch(
      `${GEONAMES_BASE_URL}/searchJSON?${searchParams.toString()}`,
    );

    if (!response.ok) {
      throw new BadRequestException('GeoNames search request failed');
    }

    const payload = (await response.json()) as GeoNamesSearchResponse;
    const hits = payload.geonames ?? [];

    const results = await Promise.all(
      hits.map((hit) => this.normalizeHit(hit, params.components, username)),
    );

    const unique = new Map<string, LocationSearchResult>();
    for (const result of results) {
      if (result.displayLabel.trim().length > 0) {
        unique.set(result.displayLabel, result);
      }
    }

    return [...unique.values()];
  }

  async testConnection(
    credentials: ResolvedLocationCredentials,
  ): Promise<void> {
    const username = credentials.geonamesUsername;
    if (!username) {
      throw new BadRequestException('GeoNames username is required');
    }

    const response = await fetch(
      `${GEONAMES_BASE_URL}/searchJSON?q=India&maxRows=1&username=${encodeURIComponent(username)}`,
    );

    if (!response.ok) {
      throw new BadRequestException('GeoNames connection test failed');
    }

    const payload = (await response.json()) as {
      status?: { message?: string };
    };
    if (payload.status?.message) {
      throw new BadRequestException(payload.status.message);
    }
  }

  private async normalizeHit(
    hit: GeoNamesSearchHit,
    components: LocationComponent[],
    username: string,
  ): Promise<LocationSearchResult> {
    const value: LocationValue = {
      city: null,
      state: null,
      country: null,
      region: null,
    };

    if (hit.fcode === 'PCLI') {
      value.country = hit.name?.trim() ?? null;
    } else if (hit.fcode === 'ADM1') {
      value.state = hit.name?.trim() ?? null;
      value.country = hit.countryName?.trim() ?? null;
    } else if (hit.fcl === 'P') {
      value.city = hit.name?.trim() ?? null;
      value.state = hit.adminName1?.trim() ?? null;
      value.country = hit.countryName?.trim() ?? null;
    } else {
      value.state = hit.adminName1?.trim() ?? hit.name?.trim() ?? null;
      value.country = hit.countryName?.trim() ?? null;
      value.city = hit.fcl === 'P' ? (hit.name?.trim() ?? null) : null;
    }

    if (components.includes('region') && hit.countryCode) {
      value.region = await this.resolveContinent(hit.countryCode, username);
    }

    const result: LocationSearchResult = {
      displayLabel: buildLocationDisplayLabel(value, components),
    };

    for (const component of components) {
      const part = value[component];
      if (part) {
        result[component] = part;
      }
    }

    return result;
  }

  private async resolveContinent(
    countryCode: string,
    username: string,
  ): Promise<string | null> {
    const response = await fetch(
      `${GEONAMES_BASE_URL}/countryInfoJSON?country=${encodeURIComponent(countryCode)}&username=${encodeURIComponent(username)}`,
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as GeoNamesCountryInfoResponse;
    const continentCode = payload.geonames?.[0]?.continent;
    if (!continentCode) {
      return null;
    }

    return CONTINENT_NAMES[continentCode] ?? continentCode;
  }
}
