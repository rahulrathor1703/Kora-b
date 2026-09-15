import { Module, forwardRef } from '@nestjs/common';
import { EmailCampaignsModule } from '../email-campaigns/email-campaigns.module';
import { ListCampaignMemberSyncService } from './list-campaign-member-sync.service';

@Module({
  imports: [forwardRef(() => EmailCampaignsModule)],
  providers: [ListCampaignMemberSyncService],
  exports: [ListCampaignMemberSyncService],
})
export class ListCampaignSyncModule {}
