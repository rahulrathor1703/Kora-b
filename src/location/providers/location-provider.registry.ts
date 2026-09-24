import { Injectable } from '@nestjs/common';
import { CustomLocationProvider } from './custom.provider';
import { GeonamesLocationProvider } from './geonames.provider';
import type {
  LocationProviderAdapter,
  ResolvedLocationCredentials,
} from './location-provider.types';

@Injectable()
export class LocationProviderRegistry {
  private readonly geonamesProvider = new GeonamesLocationProvider();
  private readonly customProvider = new CustomLocationProvider();

  resolve(credentials: ResolvedLocationCredentials): LocationProviderAdapter {
    return credentials.provider === 'custom'
      ? this.customProvider
      : this.geonamesProvider;
  }
}
