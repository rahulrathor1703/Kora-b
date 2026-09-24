import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbacModule } from '../abac/abac.module';
import { AuthModule } from '../auth/auth.module';
import { CryptoModule } from '../common/crypto/crypto.module';
import { WebsitePropertyEntity } from '../on-page-seo/entities/website-property.entity';
import { OrganizationsModule } from '../organizations/organizations.module';
import { RbacModule } from '../rbac/rbac.module';
import { OrganizationGoogleConnectionEntity } from './entities/organization-google-connection.entity';
import { OrganizationGoogleOAuthAppEntity } from './entities/organization-google-oauth-app.entity';
import { OrganizationWebsiteSettingsEntity } from './entities/organization-website-settings.entity';
import { OrganizationGoogleConnectionRepository } from './google-connection/organization-google-connection.repository';
import { OrganizationGoogleConnectionController } from './google-connection/organization-google-connection.controller';
import { WebsiteGoogleConnectionController } from './google-connection/website-google-connection.controller';
import { WebsiteGoogleConnectionOAuthService } from './google-connection/website-google-connection-oauth.service';
import { WebsiteGoogleOAuthCredentialsService } from './google-connection/website-google-oauth-credentials.service';
import { WebsitePropertyGoogleConnectionController } from './google-connection/website-property-google-connection.controller';
import { WebsitePropertyAccessRepository } from './google-connection/website-property-access.repository';
import { OrganizationGoogleOAuthAppController } from './google-oauth-apps/organization-google-oauth-app.controller';
import { OrganizationGoogleOAuthAppRepository } from './google-oauth-apps/organization-google-oauth-app.repository';
import { OrganizationGoogleOAuthAppService } from './google-oauth-apps/organization-google-oauth-app.service';
import { WebsiteGooglePropertiesController } from './google-properties/website-google-properties.controller';
import { WebsiteGooglePropertiesService } from './google-properties/website-google-properties.service';
import { WebsiteSettingsController } from './settings/website-settings.controller';
import { WebsiteSettingsRepository } from './settings/website-settings.repository';
import { WebsiteSettingsService } from './settings/website-settings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganizationGoogleConnectionEntity,
      OrganizationGoogleOAuthAppEntity,
      OrganizationWebsiteSettingsEntity,
      WebsitePropertyEntity,
    ]),
    CryptoModule,
    OrganizationsModule,
    RbacModule,
    forwardRef(() => AuthModule),
    forwardRef(() => AbacModule),
  ],
  controllers: [
    OrganizationGoogleConnectionController,
    OrganizationGoogleOAuthAppController,
    WebsiteGoogleConnectionController,
    WebsitePropertyGoogleConnectionController,
    WebsiteGooglePropertiesController,
    WebsiteSettingsController,
  ],
  providers: [
    OrganizationGoogleConnectionRepository,
    OrganizationGoogleOAuthAppRepository,
    WebsitePropertyAccessRepository,
    WebsiteGoogleOAuthCredentialsService,
    WebsiteGoogleConnectionOAuthService,
    OrganizationGoogleOAuthAppService,
    WebsiteGooglePropertiesService,
    WebsiteSettingsRepository,
    WebsiteSettingsService,
  ],
  exports: [
    WebsiteGoogleConnectionOAuthService,
    WebsiteSettingsService,
    WebsiteGooglePropertiesService,
    OrganizationGoogleOAuthAppService,
  ],
})
export class WebsiteModule {}
