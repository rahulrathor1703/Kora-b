import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbacModule } from '../abac/abac.module';
import { AuthModule } from '../auth/auth.module';
import { CompanyEntity } from '../companies/entities/company.entity';
import { EmailCampaignEntity } from '../email-campaigns/entities/email-campaign.entity';
import { MailboxEntity } from '../mailboxes/entities/mailbox.entity';
import { WebsitePropertyEntity } from '../on-page-seo/entities/website-property.entity';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ProspectEntity } from '../prospects/entities/prospect.entity';
import { RbacModule } from '../rbac/rbac.module';
import { User } from '../users/entities/user.entity';
import { InvitationEntity } from '../invitations/entities/invitation.entity';
import { OrganizationEntitlementsEntity } from './entities/organization-entitlements.entity';
import { ModuleAccessGuard } from './guards/module-access.guard';
import { OrganizationEntitlementsController } from './organization-entitlements.controller';
import { OrgEntitlementsRepository } from './org-entitlements.repository';
import { OrgQuotaRepository } from './org-quota.repository';
import { OrgEntitlementsService } from './org-entitlements.service';
import { OrgQuotaService } from './org-quota.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganizationEntitlementsEntity,
      MailboxEntity,
      EmailCampaignEntity,
      ProspectEntity,
      CompanyEntity,
      WebsitePropertyEntity,
      User,
      InvitationEntity,
    ]),
    OrganizationsModule,
    RbacModule,
    forwardRef(() => AuthModule),
    forwardRef(() => AbacModule),
  ],
  controllers: [OrganizationEntitlementsController],
  providers: [
    OrgEntitlementsRepository,
    OrgQuotaRepository,
    OrgEntitlementsService,
    OrgQuotaService,
    ModuleAccessGuard,
  ],
  exports: [
    OrgEntitlementsRepository,
    OrgQuotaRepository,
    OrgEntitlementsService,
    OrgQuotaService,
    ModuleAccessGuard,
  ],
})
export class OrgEntitlementsModule {}
