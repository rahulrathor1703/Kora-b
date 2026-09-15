import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbacModule } from '../abac/abac.module';
import { AuthModule } from '../auth/auth.module';
import { CryptoModule } from '../common/crypto/crypto.module';
import { EmailCampaignsModule } from '../email-campaigns/email-campaigns.module';
import { RbacModule } from '../rbac/rbac.module';
import { MailboxEntity } from './entities/mailbox.entity';
import { MailboxMapper } from './mappers/mailbox.mapper';
import { DomainDnsService } from './domain-dns.service';
import { MailboxesController } from './mailboxes.controller';
import { MailboxesOAuthController } from './mailboxes-oauth.controller';
import { MailboxesOAuthService } from './mailboxes-oauth.service';
import { MailboxesRepository } from './mailboxes.repository';
import { MailboxesService } from './mailboxes.service';
import { OrgEntitlementsModule } from '../org-entitlements/org-entitlements.module';
import { OAuthSessionStore } from './oauth-session.store';
import { GmailProviderAdapter } from './providers/gmail-provider.adapter';
import { MailboxProviderRegistry } from './providers/mailbox-provider.registry';
import { OutlookProviderAdapter } from './providers/outlook-provider.adapter';
import { SmtpProviderAdapter } from './providers/smtp-provider.adapter';
import { MailboxOAuthTokenService } from './mailbox-oauth-token.service';
import { MailboxSendService } from './mailbox-send.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MailboxEntity]),
    CryptoModule,
    RbacModule,
    forwardRef(() => EmailCampaignsModule),
    forwardRef(() => AuthModule),
    forwardRef(() => AbacModule),
    OrgEntitlementsModule,
  ],
  controllers: [MailboxesController, MailboxesOAuthController],
  providers: [
    MailboxesRepository,
    DomainDnsService,
    MailboxesService,
    MailboxesOAuthService,
    MailboxOAuthTokenService,
    MailboxSendService,
    OAuthSessionStore,
    MailboxMapper,
    MailboxProviderRegistry,
    GmailProviderAdapter,
    OutlookProviderAdapter,
    SmtpProviderAdapter,
  ],
  exports: [
    MailboxesService,
    MailboxesRepository,
    MailboxOAuthTokenService,
    MailboxSendService,
  ],
})
export class MailboxesModule {}
