import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbacModule } from '../abac/abac.module';
import { AuthModule } from '../auth/auth.module';
import { CryptoModule } from '../common/crypto/crypto.module';
import { RbacModule } from '../rbac/rbac.module';
import { OrganizationLocationSettingsEntity } from './entities/organization-location-settings.entity';
import { LocationSearchController } from './location-search.controller';
import { LocationSearchService } from './location-search.service';
import { LocationSettingsController } from './location-settings.controller';
import { LocationSettingsRepository } from './location-settings.repository';
import { LocationSettingsService } from './location-settings.service';
import { LocationSettingsMapper } from './mappers/location-settings.mapper';
import { LocationProviderRegistry } from './providers/location-provider.registry';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrganizationLocationSettingsEntity]),
    CryptoModule,
    RbacModule,
    forwardRef(() => AuthModule),
    forwardRef(() => AbacModule),
  ],
  controllers: [LocationSettingsController, LocationSearchController],
  providers: [
    LocationSettingsRepository,
    LocationSettingsService,
    LocationSettingsMapper,
    LocationSearchService,
    LocationProviderRegistry,
  ],
  exports: [LocationSettingsService, LocationSearchService],
})
export class LocationModule {}
