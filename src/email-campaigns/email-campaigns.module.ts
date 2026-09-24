import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbacModule } from '../abac/abac.module';
import { AuthModule } from '../auth/auth.module';
import { ContactListsModule } from '../contact-lists/contact-lists.module';
import { EmailConfigModule } from '../email-config/email-config.module';
import { ManualListsModule } from '../manual-lists/manual-lists.module';
import { OrgEntitlementsModule } from '../org-entitlements/org-entitlements.module';
import { MailboxesModule } from '../mailboxes/mailboxes.module';
import { EmailAttachmentsModule } from '../email-attachments/email-attachments.module';
import { RbacModule } from '../rbac/rbac.module';
import { CampaignAudienceResolverService } from './campaign-audience-resolver.service';
import { CampaignMessageMetadataBackfillService } from './campaign-message-metadata-backfill.service';
import { CampaignMessageCorrelationService } from './campaign-message-correlation.service';
import { CampaignEventBackfillService } from './campaign-event-backfill.service';
import { CampaignEventService } from './campaign-event.service';
import { CampaignEventsService } from './campaign-events.service';
import { CampaignMergeFieldCatalogService } from './campaign-merge-field-catalog.service';
import { CampaignMergeTagService } from './campaign-merge-tag.service';
import {
  CampaignProgressService,
  EmailCampaignRecipientsService,
} from './campaign-progress.service';
import { CampaignSchedulerService } from './campaign-scheduler.service';
import { CampaignSendService } from './campaign-send.service';
import { CampaignTrackingController } from './campaign-tracking.controller';
import { CampaignTrackingService } from './campaign-tracking.service';
import { CampaignTrackingSyncService } from './campaign-tracking-sync.service';
import { EmailCampaignEventsRepository } from './email-campaign-events.repository';
import { EmailCampaignMessagesRepository } from './email-campaign-messages.repository';
import { EmailCampaignRecipientsRepository } from './email-campaign-recipients.repository';
import { EmailCampaignEventEntity } from './entities/email-campaign-event.entity';
import { EmailCampaignMailboxSenderEntity } from './entities/email-campaign-mailbox-sender.entity';
import { EmailCampaignMessageEntity } from './entities/email-campaign-message.entity';
import { EmailCampaignRecipientEntity } from './entities/email-campaign-recipient.entity';
import { EmailCampaignSequenceStepEntity } from './entities/email-campaign-sequence-step.entity';
import { EmailCampaignEntity } from './entities/email-campaign.entity';
import { EmailCampaignCustomFieldDefinitionEntity } from './entities/email-campaign-custom-field-definition.entity';
import { EmailCampaignCustomFieldOptionEntity } from './entities/email-campaign-custom-field-option.entity';
import { EmailCampaignDeleteRequestEntity } from './entities/email-campaign-delete-request.entity';
import { EmailCampaignsController } from './email-campaigns.controller';
import { EmailCampaignsRepository } from './email-campaigns.repository';
import { EmailCampaignsService } from './email-campaigns.service';
import { EmailCampaignMapper } from './mappers/email-campaign.mapper';
import { CampaignEventsMapper } from './mappers/campaign-events.mapper';
import { CampaignListMetricsRepository } from './campaign-list-metrics.repository';
import { CampaignListMetricsService } from './campaign-list-metrics.service';
import { CampaignListMetricsMapper } from './mappers/campaign-list-metrics.mapper';
import { CampaignProgressMapper } from './mappers/campaign-progress.mapper';
import { CampaignRecipientMapper } from './mappers/campaign-recipient.mapper';
import { BounceMonitorService } from './bounce-monitor/bounce-monitor.service';
import { ReplyMonitorService } from './reply-monitor/reply-monitor.service';
import { AudienceContactsRepository } from './audience-contacts.repository';
import { AudienceContactEntity } from './entities/audience-contact.entity';
import { EmailExcludedAddressEntity } from './entities/email-excluded-address.entity';
import { EmailExcludedRepository } from './email-excluded.repository';
import { EmailExcludedService } from './email-excluded.service';
import { EmailExcludedController } from './email-excluded.controller';
import { EmailInboxController } from './email-inbox.controller';
import { EmailInboxService } from './email-inbox.service';
import { EmailInboxMapper } from './mappers/email-inbox.mapper';
import { CampaignCustomFieldsController } from './campaign-custom-fields.controller';
import { CampaignCustomFieldsRepository } from './campaign-custom-fields.repository';
import { CampaignCustomFieldsService } from './campaign-custom-fields.service';
import { CampaignCustomFieldMapper } from './mappers/campaign-custom-field.mapper';
import { CampaignMailboxSendersService } from './campaign-mailbox-senders.service';
import { TrackingConfigService } from './tracking-config.service';
import { EmailCampaignDeleteRequestsRepository } from './email-campaign-delete-requests.repository';
import { EmailCampaignDeleteRequestsService } from './email-campaign-delete-requests.service';
import { EmailCampaignDeleteRequestMapper } from './mappers/email-campaign-delete-request.mapper';
import { CampaignIdFormatController } from './campaign-id-format/campaign-id-format.controller';
import { CampaignIdFormatRepository } from './campaign-id-format/campaign-id-format.repository';
import { CampaignIdFormatService } from './campaign-id-format/campaign-id-format.service';
import { OrganizationCampaignIdSettingsEntity } from './campaign-id-format/entities/organization-campaign-id-settings.entity';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      EmailCampaignEntity,
      EmailCampaignSequenceStepEntity,
      EmailCampaignMailboxSenderEntity,
      EmailCampaignRecipientEntity,
      EmailCampaignMessageEntity,
      EmailCampaignEventEntity,
      AudienceContactEntity,
      EmailExcludedAddressEntity,
      EmailCampaignCustomFieldDefinitionEntity,
      EmailCampaignCustomFieldOptionEntity,
      EmailCampaignDeleteRequestEntity,
      OrganizationCampaignIdSettingsEntity,
    ]),
    RbacModule,
    forwardRef(() => AuthModule),
    forwardRef(() => AbacModule),
    EmailConfigModule,
    forwardRef(() => ContactListsModule),
    forwardRef(() => ManualListsModule),
    forwardRef(() => MailboxesModule),
    forwardRef(() => EmailAttachmentsModule),
    OrgEntitlementsModule,
  ],
  controllers: [
    CampaignCustomFieldsController,
    CampaignIdFormatController,
    EmailCampaignsController,
    CampaignTrackingController,
    EmailExcludedController,
    EmailInboxController,
  ],
  providers: [
    EmailCampaignsRepository,
    CampaignListMetricsRepository,
    CampaignListMetricsService,
    CampaignListMetricsMapper,
    EmailCampaignRecipientsRepository,
    EmailCampaignMessagesRepository,
    EmailCampaignEventsRepository,
    EmailCampaignsService,
    EmailCampaignMapper,
    CampaignProgressMapper,
    CampaignRecipientMapper,
    CampaignEventsMapper,
    CampaignProgressService,
    EmailCampaignRecipientsService,
    CampaignEventsService,
    CampaignAudienceResolverService,
    CampaignMergeTagService,
    CampaignMergeFieldCatalogService,
    CampaignSendService,
    CampaignSchedulerService,
    CampaignTrackingService,
    CampaignTrackingSyncService,
    CampaignEventService,
    CampaignEventBackfillService,
    CampaignMessageMetadataBackfillService,
    CampaignMessageCorrelationService,
    BounceMonitorService,
    ReplyMonitorService,
    AudienceContactsRepository,
    EmailExcludedRepository,
    EmailExcludedService,
    EmailInboxService,
    EmailInboxMapper,
    CampaignCustomFieldsRepository,
    CampaignCustomFieldsService,
    CampaignCustomFieldMapper,
    CampaignMailboxSendersService,
    TrackingConfigService,
    EmailCampaignDeleteRequestsRepository,
    EmailCampaignDeleteRequestsService,
    EmailCampaignDeleteRequestMapper,
    CampaignIdFormatRepository,
    CampaignIdFormatService,
  ],
  exports: [
    EmailCampaignsService,
    EmailCampaignsRepository,
    EmailCampaignRecipientsRepository,
    EmailCampaignRecipientsService,
    CampaignAudienceResolverService,
    EmailExcludedRepository,
  ],
})
export class EmailCampaignsModule {}
