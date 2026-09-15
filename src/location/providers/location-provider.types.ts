import type {
  LocationComponent,
  LocationValue,
} from '../../common/location/location-field.types';

export interface LocationSearchResult {
  city?: string;
  state?: string;
  country?: string;
  region?: string;
  displayLabel: string;
}

export interface LocationSearchParams {
  query: string;
  components: LocationComponent[];
  trigger: LocationComponent;
}

export interface ResolvedLocationCredentials {
  provider: 'geonames' | 'custom';
  geonamesUsername?: string;
  customApiUrl?: string;
  customApiKey?: string;
}

export interface LocationProviderAdapter {
  search(
    params: LocationSearchParams,
    credentials: ResolvedLocationCredentials,
  ): Promise<LocationSearchResult[]>;
  testConnection(credentials: ResolvedLocationCredentials): Promise<void>;
}

export function toLocationValue(result: LocationSearchResult): LocationValue {
  return {
    city: result.city ?? null,
    state: result.state ?? null,
    country: result.country ?? null,
    region: result.region ?? null,
  };
}
