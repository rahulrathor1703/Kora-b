import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailCampaignMessagesRepository } from './email-campaign-messages.repository';
import { CampaignEventService } from './campaign-event.service';
import { verifyClickLink } from './campaign-tracking-signature.util';
import type { ResolveClickRedirectInput } from './campaign-tracking-request.util';

@Injectable()
export class CampaignTrackingService {
  private readonly logger = new Logger(CampaignTrackingService.name);

  constructor(
    private readonly messagesRepository: EmailCampaignMessagesRepository,
    private readonly campaignEventService: CampaignEventService,
    private readonly configService: ConfigService,
  ) {}

  async recordOpen(
    trackingToken: string,
    context?: { userAgent?: string; ipAddress?: string },
  ): Promise<void> {
    const message =
      await this.messagesRepository.findByTrackingToken(trackingToken);

    if (!message || message.deliveryStatus !== 'sent') {
      throw new NotFoundException('Tracking token not found');
    }

    await this.campaignEventService.recordOpen(message, new Date(), {
      userAgent: context?.userAgent,
      ipAddress: context?.ipAddress,
      metadata: {
        userAgent: context?.userAgent,
        ipAddress: context?.ipAddress,
      },
    });

    if (this.isDebugLoggingEnabled()) {
      this.logger.debug(
        `Open recorded for campaign ${message.campaignId}, message ${message.id}, token ${trackingToken.slice(0, 8)}…`,
      );
    } else {
      this.logger.log(
        `Open recorded for campaign ${message.campaignId}, message ${message.id}`,
      );
    }
  }

  async resolveClickRedirect(
    trackingToken: string,
    input: ResolveClickRedirectInput,
  ): Promise<string> {
    const message =
      await this.messagesRepository.findByTrackingToken(trackingToken);

    if (!message || message.deliveryStatus !== 'sent') {
      throw new NotFoundException('Tracking token not found');
    }

    const hmacSecret =
      this.configService.get<string>('trackingHmacSecret') ??
      'dev-secret-change-me';

    if (input.linkIndex === undefined || !input.sig) {
      throw new NotFoundException('Redirect URL is required');
    }

    const trackedLink = message.trackedLinks?.find(
      (link) => link.index === input.linkIndex,
    );

    if (!trackedLink) {
      throw new NotFoundException('Tracking link not found');
    }

    if (
      !verifyClickLink(hmacSecret, trackingToken, input.linkIndex, input.sig)
    ) {
      throw new NotFoundException('Invalid click signature');
    }

    await this.campaignEventService.recordClick(message, {
      url: trackedLink.url,
      linkIndex: trackedLink.index,
      linkLabel: trackedLink.label,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    });

    if (this.isDebugLoggingEnabled()) {
      this.logger.debug(
        `Click recorded for campaign ${message.campaignId}, message ${message.id}, token ${trackingToken.slice(0, 8)}…`,
      );
    }

    return trackedLink.url;
  }

  async recordUnsubscribe(trackingToken: string): Promise<void> {
    const message =
      await this.messagesRepository.findByTrackingToken(trackingToken);

    if (!message) {
      throw new NotFoundException('Tracking token not found');
    }

    await this.campaignEventService.recordUnsubscribe(message);
  }

  private isDebugLoggingEnabled(): boolean {
    return process.env.LOG_LEVEL === 'debug';
  }
}
