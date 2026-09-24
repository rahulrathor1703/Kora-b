import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CampaignSendService } from './campaign-send.service';
import { EmailCampaignRecipientsRepository } from './email-campaign-recipients.repository';
import { EmailCampaignsRepository } from './email-campaigns.repository';

@Injectable()
export class CampaignSchedulerService {
  private readonly logger = new Logger(CampaignSchedulerService.name);
  private isProcessing = false;

  constructor(
    private readonly emailCampaignsRepository: EmailCampaignsRepository,
    private readonly campaignSendService: CampaignSendService,
    private readonly recipientsRepository: EmailCampaignRecipientsRepository,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledCampaigns(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const now = new Date();
      await this.recipientsRepository.resumeExpiredPauses(now);
      await this.emailCampaignsRepository.resumeExpiredPauses(now);

      const campaigns = await this.emailCampaignsRepository.findByStatuses([
        'scheduled',
        'sending',
      ]);

      for (const campaign of campaigns) {
        try {
          await this.campaignSendService.processCampaign(campaign);
        } catch (error) {
          this.logger.error(
            `Campaign scheduler failed for campaign ${campaign.id}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}
