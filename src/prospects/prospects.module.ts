import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BantSettingsModule } from '../bant-settings/bant-settings.module';
import { AbacModule } from '../abac/abac.module';
import { AuthModule } from '../auth/auth.module';
import { EmailCampaignsModule } from '../email-campaigns/email-campaigns.module';
import { FormsModule } from '../forms/forms.module';
import { FileParserModule } from '../common/file-parser/file-parser.module';
import { OrgEntitlementsModule } from '../org-entitlements/org-entitlements.module';
import { RbacModule } from '../rbac/rbac.module';
import { ProspectDeleteRequestEntity } from './entities/prospect-delete-request.entity';
import { ProspectEngagementEntity } from './entities/prospect-engagement.entity';
import { ProspectFieldSchemaEntity } from './entities/prospect-field-schema.entity';
import { ProspectEntity } from './entities/prospect.entity';
import { ProspectDeleteRequestMapper } from './mappers/prospect-delete-request.mapper';
import { ProspectMapper } from './mappers/prospect.mapper';
import { ProspectDeleteRequestsRepository } from './prospect-delete-requests.repository';
import { ProspectDeleteRequestsService } from './prospect-delete-requests.service';
import { ListProspectSyncService } from './list-prospect-sync.service';
import { ProspectsImportService } from './prospects-import.service';
import { ProspectsController } from './prospects.controller';
import { ProspectsRepository } from './prospects.repository';
import { ProspectsService } from './prospects.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProspectFieldSchemaEntity,
      ProspectEntity,
      ProspectEngagementEntity,
      ProspectDeleteRequestEntity,
    ]),
    FileParserModule,
    forwardRef(() => FormsModule),
    BantSettingsModule,
    RbacModule,
    forwardRef(() => EmailCampaignsModule),
    forwardRef(() => AuthModule),
    forwardRef(() => AbacModule),
    OrgEntitlementsModule,
  ],
  controllers: [ProspectsController],
  providers: [
    ProspectsRepository,
    ProspectsService,
    ProspectMapper,
    ProspectDeleteRequestsRepository,
    ProspectDeleteRequestsService,
    ProspectDeleteRequestMapper,
    ListProspectSyncService,
    ProspectsImportService,
  ],
  exports: [
    ProspectsService,
    ProspectsRepository,
    ProspectDeleteRequestsService,
    ListProspectSyncService,
    ProspectsImportService,
  ],
})
export class ProspectsModule {}
