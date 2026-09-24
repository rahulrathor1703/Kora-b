import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbacModule } from '../abac/abac.module';
import { AuthModule } from '../auth/auth.module';
import { CryptoModule } from '../common/crypto/crypto.module';
import { CompaniesModule } from '../companies/companies.module';
import { ContactListsModule } from '../contact-lists/contact-lists.module';
import { ProspectsModule } from '../prospects/prospects.module';
import { RbacModule } from '../rbac/rbac.module';
import { OrganizationNotionConnectionEntity } from './entities/organization-notion-connection.entity';
import { NotionApiClient } from './notion-api.client';
import { NotionIntegrationsController } from './notion-integrations.controller';
import { NotionIntegrationsRepository } from './notion-integrations.repository';
import { NotionIntegrationsService } from './notion-integrations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrganizationNotionConnectionEntity]),
    CryptoModule,
    RbacModule,
    CompaniesModule,
    ProspectsModule,
    ContactListsModule,
    forwardRef(() => AuthModule),
    forwardRef(() => AbacModule),
  ],
  controllers: [NotionIntegrationsController],
  providers: [
    NotionIntegrationsRepository,
    NotionIntegrationsService,
    NotionApiClient,
  ],
})
export class NotionIntegrationsModule {}
