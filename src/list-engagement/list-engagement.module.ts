import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailCampaignRecipientsRepository } from '../email-campaigns/email-campaign-recipients.repository';
import { EmailCampaignsRepository } from '../email-campaigns/email-campaigns.repository';
import { EmailCampaignMailboxSenderEntity } from '../email-campaigns/entities/email-campaign-mailbox-sender.entity';
import { EmailCampaignRecipientEntity } from '../email-campaigns/entities/email-campaign-recipient.entity';
import { EmailCampaignEntity } from '../email-campaigns/entities/email-campaign.entity';
import { ListEngagementService } from './list-engagement.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmailCampaignEntity,
      EmailCampaignMailboxSenderEntity,
      EmailCampaignRecipientEntity,
    ]),
  ],
  providers: [
    EmailCampaignsRepository,
    EmailCampaignRecipientsRepository,
    ListEngagementService,
  ],
  exports: [ListEngagementService],
})
export class ListEngagementModule {}
