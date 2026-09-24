import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { MailboxDailyLimitReachedError } from '../mailboxes/mailbox-daily-limit-reached.error';
import { getMailboxRemainingCapacity } from '../mailboxes/mailbox-daily.util';
import { MailboxSendService } from '../mailboxes/mailbox-send.service';
import { MailboxesRepository } from '../mailboxes/mailboxes.repository';
import type { MailboxEntity } from '../mailboxes/entities/mailbox.entity';
import {
  computeNextSendAtForStep,
  getCalendarDateKeyInTimezone,
  hasLaunchStarted,
  isActiveWeekday,
  isWithinSendingWindow,
  resolveActiveWeekdays,
} from './campaign-schedule.util';
import {
  assignInitialNextSendAtToRecipients,
  assignStepNextSendAtToRecipients,
} from './campaign-send-spacing.util';
import type { EmailCampaignRecipientEntity } from './entities/email-campaign-recipient.entity';
import { CampaignMergeTagService } from './campaign-merge-tag.service';
import { CampaignEventService } from './campaign-event.service';
import { signClickLink } from './campaign-tracking-signature.util';
import { injectCorrelationMarker } from './campaign-correlation.util';
import { injectEmailTracking } from './campaign-tracking.util';
import {
  isTrackingBaseUrlPubliclyReachable,
  probeTrackingOpenEndpoint,
} from './tracking-config.util';
import {
  appendSenderSignature,
  normalizeEmailBodyHtml,
  getPlainTextFromHtml,
} from './email-body-html.util';
import { EmailAttachmentsService } from '../email-attachments/email-attachments.service';
import { EmailCampaignMessagesRepository } from './email-campaign-messages.repository';
import { EmailCampaignRecipientsRepository } from './email-campaign-recipients.repository';
import { EmailExcludedRepository } from './email-excluded.repository';
import { EmailCampaignsRepository } from './email-campaigns.repository';
import { EmailCampaignMessageEntity } from './entities/email-campaign-message.entity';
import type { EmailCampaignMailboxSenderEntity } from './entities/email-campaign-mailbox-sender.entity';
import type { EmailCampaignEntity } from './entities/email-campaign.entity';

@Injectable()
export class CampaignSendService {
  private readonly logger = new Logger(CampaignSendService.name);

  constructor(
    private readonly emailCampaignsRepository: EmailCampaignsRepository,
    private readonly recipientsRepository: EmailCampaignRecipientsRepository,
    private readonly messagesRepository: EmailCampaignMessagesRepository,
    private readonly excludedRepository: EmailExcludedRepository,
    private readonly mailboxesRepository: MailboxesRepository,
    private readonly mailboxSendService: MailboxSendService,
    private readonly mergeTagService: CampaignMergeTagService,
    private readonly campaignEventService: CampaignEventService,
    private readonly configService: ConfigService,
    private readonly emailAttachmentsService: EmailAttachmentsService,
  ) {}

  async processCampaign(
    campaign: EmailCampaignEntity,
    now = new Date(),
  ): Promise<void> {
    if (!campaign.launchAt || !campaign.timezone) {
      return;
    }

    if (
      campaign.sendingWindowStartMinutes === null ||
      campaign.sendingWindowEndMinutes === null
    ) {
      return;
    }

    if (!hasLaunchStarted(campaign.launchAt, now)) {
      return;
    }

    const activeWeekdays = resolveActiveWeekdays(campaign.activeWeekdays);

    if (!isActiveWeekday(now, activeWeekdays, campaign.timezone)) {
      return;
    }

    if (
      !isWithinSendingWindow(
        now,
        campaign.sendingWindowStartMinutes,
        campaign.sendingWindowEndMinutes,
        campaign.timezone,
      )
    ) {
      return;
    }

    const todayKey = getCalendarDateKeyInTimezone(now, campaign.timezone);
    if (campaign.sendsTodayDate !== todayKey) {
      campaign.sendsTodayDate = todayKey;
      campaign.sendsTodayCount = 0;
    }

    const remainingBatch = campaign.dailyBatchSize - campaign.sendsTodayCount;
    if (remainingBatch <= 0) {
      await this.emailCampaignsRepository.save(campaign);
      await this.refreshCampaignStatus(campaign);
      return;
    }

    const steps = [...(campaign.steps ?? [])].sort(
      (a, b) => a.stepOrder - b.stepOrder,
    );
    const senders = (campaign.mailboxSenders ?? []).filter(
      (sender) => sender.status === 'active',
    );

    if (steps.length === 0 || senders.length === 0) {
      return;
    }

    for (const sender of senders) {
      this.applySenderDailyReset(sender, todayKey);
    }

    const mailboxMap = await this.loadMailboxMap(
      senders,
      campaign.organizationId,
      now,
    );
    const totalMailboxCapacity = this.getTotalRemainingMailboxCapacity(
      senders,
      mailboxMap,
      now,
    );

    if (totalMailboxCapacity <= 0) {
      await this.emailCampaignsRepository.save(campaign);
      await this.refreshCampaignStatus(campaign);
      return;
    }

    await this.ensureInitialSendSchedule(campaign);
    await this.ensureFollowUpSendSchedules(campaign);

    const fetchLimit = Math.min(1, remainingBatch, totalMailboxCapacity);
    const recipients = await this.recipientsRepository.findReadyToSend(
      campaign.id,
      fetchLimit,
      now,
    );

    if (recipients.length === 0) {
      await this.emailCampaignsRepository.save(campaign);
      await this.refreshCampaignStatus(campaign);
      return;
    }

    const excludedEmails = new Set(
      await this.excludedRepository.findEmailsByOrganizationId(
        campaign.organizationId,
      ),
    );

    const trackingBaseUrl = this.configService.get<string>(
      'trackingBaseUrl',
      'http://localhost:3008',
    );

    await this.assertTrackingIsReachable(trackingBaseUrl);

    let sentCount = 0;
    let senderIndex = 0;
    const sendersToPersist = new Set<EmailCampaignMailboxSenderEntity>();

    for (const recipient of recipients) {
      if (excludedEmails.has(recipient.email.toLowerCase())) {
        recipient.status = 'failed';
        recipient.contactDisposition = 'stopped';
        recipient.nextSendAt = null;
        await this.recipientsRepository.save(recipient);
        continue;
      }

      const step = steps.find(
        (candidate) => candidate.stepOrder === recipient.currentStepOrder,
      );

      if (!step) {
        recipient.status = 'completed';
        recipient.nextSendAt = null;
        await this.recipientsRepository.save(recipient);
        continue;
      }

      const senderSelection = this.pickSenderWithCapacity(
        senders,
        mailboxMap,
        senderIndex,
        now,
      );

      if (!senderSelection) {
        break;
      }

      const { sender, nextSenderIndex } = senderSelection;
      senderIndex = nextSenderIndex;

      const trackingToken = randomUUID();
      const trackingContext = {
        baseUrl: trackingBaseUrl,
        token: trackingToken,
      };

      const renderedSubject = this.mergeTagService.render(
        step.subject,
        recipient.mergeFields,
        sender,
        trackingContext,
      );
      const normalizedBody = normalizeEmailBodyHtml(step.body);
      const bodyWithSignature =
        step.includeSignature !== false
          ? appendSenderSignature(normalizedBody, sender.signature)
          : normalizedBody;
      const renderedBody = this.mergeTagService.render(
        bodyWithSignature,
        recipient.mergeFields,
        sender,
        trackingContext,
      );

      const hmacSecret =
        this.configService.get<string>('trackingHmacSecret') ??
        'dev-secret-change-me';
      const { html: trackedHtml, trackedLinks } = injectEmailTracking(
        renderedBody,
        trackingBaseUrl,
        trackingToken,
        (linkIndex) => signClickLink(hmacSecret, trackingToken, linkIndex),
      );
      const correlatedHtml = injectCorrelationMarker(
        trackedHtml,
        trackingToken,
      );

      const message = new EmailCampaignMessageEntity();
      message.campaignId = campaign.id;
      message.recipientId = recipient.id;
      message.stepOrder = step.stepOrder;
      message.mailboxId = sender.mailboxId;
      message.sentSubject = renderedSubject;
      message.trackingToken = trackingToken;
      message.providerMessageId = null;
      message.deliveryStatus = 'pending';
      message.sentAt = null;
      message.bouncedAt = null;
      message.bounceReason = null;
      message.openedAt = null;
      message.openCount = 0;
      message.clickedAt = null;
      message.clickCount = 0;
      message.trackedLinks = trackedLinks;

      await this.messagesRepository.save(message);

      try {
        const attachments =
          await this.emailAttachmentsService.loadCampaignStepAttachmentBuffers(
            step.id,
          );

        const sendResult = await this.mailboxSendService.sendCampaignEmail({
          mailboxId: sender.mailboxId,
          organizationId: campaign.organizationId,
          fromName: sender.senderName,
          fromEmail: sender.senderEmail,
          to: recipient.email,
          subject: renderedSubject,
          html: correlatedHtml,
          text: getPlainTextFromHtml(correlatedHtml),
          trackingToken,
          attachments,
        });

        await this.campaignEventService.recordSent(
          message,
          sendResult.messageId,
          now,
        );
      } catch (error) {
        if (error instanceof MailboxDailyLimitReachedError) {
          await this.messagesRepository.removePending(message);
          break;
        }

        this.logger.error(
          `Failed to send campaign ${campaign.id} to ${recipient.email}`,
          error instanceof Error ? error.stack : undefined,
        );

        const reason = error instanceof Error ? error.message : 'Send failed';
        await this.campaignEventService.recordSendFailed(message, reason, now);

        recipient.status = 'failed';
        recipient.nextSendAt = null;
        await this.recipientsRepository.save(recipient);
        continue;
      }

      const mailbox = mailboxMap.get(sender.mailboxId);
      if (mailbox) {
        mailbox.dailySendsUsed += 1;
      }

      sender.sendsTodayCount += 1;
      sender.sendsTodayDate = todayKey;
      sendersToPersist.add(sender);

      recipient.lastSentAt = now;
      recipient.status = 'active';

      const nextStep = steps.find(
        (candidate) => candidate.stepOrder === recipient.currentStepOrder + 1,
      );

      if (nextStep) {
        recipient.currentStepOrder = nextStep.stepOrder;
        recipient.nextSendAt = computeNextSendAtForStep(
          nextStep,
          now,
          campaign.sendingWindowStartMinutes,
          campaign.timezone,
          activeWeekdays,
        );
        await this.recipientsRepository.save(recipient);
        const dueDateKey = getCalendarDateKeyInTimezone(
          recipient.nextSendAt,
          campaign.timezone,
        );
        await this.spreadFollowUpCohort(
          campaign,
          nextStep.stepOrder,
          dueDateKey,
        );
      } else {
        recipient.status = 'completed';
        recipient.contactDisposition = 'done';
        recipient.nextSendAt = null;
      }

      if (!nextStep) {
        await this.recipientsRepository.save(recipient);
      }
      sentCount += 1;
    }

    if (sentCount > 0 && campaign.status === 'scheduled') {
      campaign.status = 'sending';
    }

    campaign.sendsTodayCount += sentCount;
    await this.emailCampaignsRepository.save(campaign);

    if (sendersToPersist.size > 0) {
      await this.emailCampaignsRepository.saveMailboxSenders([
        ...sendersToPersist,
      ]);
    }

    await this.refreshCampaignStatus(campaign);
  }

  private async ensureInitialSendSchedule(
    campaign: EmailCampaignEntity,
  ): Promise<void> {
    if (
      campaign.launchAt === null ||
      campaign.timezone === null ||
      campaign.sendingWindowStartMinutes === null ||
      campaign.sendingWindowEndMinutes === null
    ) {
      return;
    }

    const pending =
      await this.recipientsRepository.findStepOnePendingWithoutSchedule(
        campaign.id,
      );

    if (pending.length === 0) {
      return;
    }

    const launchDateKey = getCalendarDateKeyInTimezone(
      campaign.launchAt,
      campaign.timezone,
    );

    assignInitialNextSendAtToRecipients(
      pending,
      launchDateKey,
      campaign.sendingWindowStartMinutes,
      campaign.sendingWindowEndMinutes,
      campaign.timezone,
      campaign.dailyBatchSize,
      campaign.activeWeekdays,
      campaign.id,
    );

    await this.recipientsRepository.saveMany(pending);
  }

  private async ensureFollowUpSendSchedules(
    campaign: EmailCampaignEntity,
  ): Promise<void> {
    if (
      campaign.timezone === null ||
      campaign.sendingWindowStartMinutes === null ||
      campaign.sendingWindowEndMinutes === null
    ) {
      return;
    }

    const recipients =
      await this.recipientsRepository.findFollowUpEligibleWithNextSendAt(
        campaign.id,
      );

    if (recipients.length === 0) {
      return;
    }

    const groups = this.groupFollowUpRecipientsByStepAndDate(
      recipients,
      campaign.timezone,
    );

    const toPersist: EmailCampaignRecipientEntity[] = [];

    for (const group of groups.values()) {
      if (!this.followUpCohortNeedsSpread(group)) {
        continue;
      }

      this.applyFollowUpSpread(campaign, group);
      toPersist.push(...group);
    }

    if (toPersist.length > 0) {
      await this.recipientsRepository.saveMany(toPersist);
    }
  }

  private async spreadFollowUpCohort(
    campaign: EmailCampaignEntity,
    stepOrder: number,
    dueDateKey: string,
  ): Promise<void> {
    if (
      campaign.timezone === null ||
      campaign.sendingWindowStartMinutes === null ||
      campaign.sendingWindowEndMinutes === null
    ) {
      return;
    }

    const onStep =
      await this.recipientsRepository.findFollowUpEligibleOnStepAndSendDate(
        campaign.id,
        stepOrder,
      );

    const cohort = onStep.filter(
      (recipient) =>
        recipient.nextSendAt !== null &&
        getCalendarDateKeyInTimezone(
          recipient.nextSendAt,
          campaign.timezone!,
        ) === dueDateKey,
    );

    if (cohort.length === 0) {
      return;
    }

    this.applyFollowUpSpread(campaign, cohort);
    await this.recipientsRepository.saveMany(cohort);
  }

  private applyFollowUpSpread(
    campaign: EmailCampaignEntity,
    cohort: EmailCampaignRecipientEntity[],
  ): void {
    if (
      campaign.timezone === null ||
      campaign.sendingWindowStartMinutes === null ||
      campaign.sendingWindowEndMinutes === null ||
      cohort.length === 0 ||
      cohort[0].nextSendAt === null
    ) {
      return;
    }

    const dueDateKey = getCalendarDateKeyInTimezone(
      cohort[0].nextSendAt,
      campaign.timezone,
    );
    const stepOrder = cohort[0].currentStepOrder;

    assignStepNextSendAtToRecipients(
      cohort,
      dueDateKey,
      campaign.sendingWindowStartMinutes,
      campaign.sendingWindowEndMinutes,
      campaign.timezone,
      campaign.dailyBatchSize,
      campaign.activeWeekdays,
      campaign.id,
      `step-${stepOrder}`,
    );
  }

  private groupFollowUpRecipientsByStepAndDate(
    recipients: EmailCampaignRecipientEntity[],
    timezone: string,
  ): Map<string, EmailCampaignRecipientEntity[]> {
    const groups = new Map<string, EmailCampaignRecipientEntity[]>();

    for (const recipient of recipients) {
      if (recipient.nextSendAt === null) {
        continue;
      }

      const dateKey = getCalendarDateKeyInTimezone(
        recipient.nextSendAt,
        timezone,
      );
      const key = `${recipient.currentStepOrder}:${dateKey}`;
      const group = groups.get(key) ?? [];
      group.push(recipient);
      groups.set(key, group);
    }

    for (const group of groups.values()) {
      group.sort((left, right) => {
        const leftSent = left.lastSentAt?.getTime() ?? 0;
        const rightSent = right.lastSentAt?.getTime() ?? 0;
        if (leftSent !== rightSent) {
          return leftSent - rightSent;
        }

        return left.createdAt.getTime() - right.createdAt.getTime();
      });
    }

    return groups;
  }

  private followUpCohortNeedsSpread(
    cohort: EmailCampaignRecipientEntity[],
  ): boolean {
    if (cohort.length <= 1) {
      return false;
    }

    const firstSendAt = cohort[0].nextSendAt?.getTime();
    return cohort.every(
      (recipient) => recipient.nextSendAt?.getTime() === firstSendAt,
    );
  }

  private async loadMailboxMap(
    senders: EmailCampaignMailboxSenderEntity[],
    organizationId: string,
    now: Date,
  ): Promise<Map<string, MailboxEntity>> {
    const mailboxIds = [...new Set(senders.map((sender) => sender.mailboxId))];
    const mailboxes = await this.mailboxesRepository.findByIdsAndOrganizationId(
      mailboxIds,
      organizationId,
    );

    const mailboxMap = new Map<string, MailboxEntity>();
    for (const mailbox of mailboxes) {
      getMailboxRemainingCapacity(mailbox, now);
      mailboxMap.set(mailbox.id, mailbox);
    }

    return mailboxMap;
  }

  private applySenderDailyReset(
    sender: EmailCampaignMailboxSenderEntity,
    todayKey: string,
  ): void {
    if (sender.sendsTodayDate !== todayKey) {
      sender.sendsTodayDate = todayKey;
      sender.sendsTodayCount = 0;
    }
  }

  private getSenderRemainingQuota(
    sender: EmailCampaignMailboxSenderEntity,
  ): number | null {
    if (sender.dailySendQuota == null) {
      return null;
    }

    return Math.max(0, sender.dailySendQuota - sender.sendsTodayCount);
  }

  private getTotalRemainingMailboxCapacity(
    senders: EmailCampaignMailboxSenderEntity[],
    mailboxMap: Map<string, MailboxEntity>,
    now: Date,
  ): number {
    let total = 0;

    for (const sender of senders) {
      const mailbox = mailboxMap.get(sender.mailboxId);
      if (!mailbox) {
        continue;
      }

      const mailboxRemaining = getMailboxRemainingCapacity(mailbox, now);
      const quotaRemaining = this.getSenderRemainingQuota(sender);

      if (quotaRemaining != null) {
        total += Math.min(mailboxRemaining, quotaRemaining);
      } else {
        total += mailboxRemaining;
      }
    }

    return total;
  }

  private pickSenderWithCapacity(
    senders: EmailCampaignMailboxSenderEntity[],
    mailboxMap: Map<string, MailboxEntity>,
    startIndex: number,
    now: Date,
  ): {
    sender: EmailCampaignMailboxSenderEntity;
    nextSenderIndex: number;
  } | null {
    for (let offset = 0; offset < senders.length; offset += 1) {
      const index = (startIndex + offset) % senders.length;
      const sender = senders[index];
      const mailbox = mailboxMap.get(sender.mailboxId);

      if (!mailbox) {
        continue;
      }

      const mailboxRemaining = getMailboxRemainingCapacity(mailbox, now);
      if (mailboxRemaining <= 0) {
        continue;
      }

      const quotaRemaining = this.getSenderRemainingQuota(sender);
      if (quotaRemaining != null && quotaRemaining <= 0) {
        continue;
      }

      return {
        sender,
        nextSenderIndex: index + 1,
      };
    }

    return null;
  }

  private async refreshCampaignStatus(
    campaign: EmailCampaignEntity,
  ): Promise<void> {
    const incomplete =
      await this.recipientsRepository.countIncompleteByCampaignId(campaign.id);

    if (incomplete === 0 && campaign.status !== 'draft') {
      campaign.status = 'sent';
      await this.emailCampaignsRepository.save(campaign);
    }
  }

  private async assertTrackingIsReachable(
    trackingBaseUrl: string,
  ): Promise<void> {
    const allowLocalTracking = this.configService.get<boolean>(
      'allowLocalTracking',
      false,
    );
    const isLocal = !isTrackingBaseUrlPubliclyReachable(trackingBaseUrl);

    if (isLocal && !allowLocalTracking) {
      throw new BadRequestException(
        `TRACKING_BASE_URL (${trackingBaseUrl}) is not publicly reachable. ` +
          'Set it to your public frontend /api proxy (e.g. https://app.example.com/api), use ngrok for local inbox testing, ' +
          'or set ALLOW_LOCAL_TRACKING=true for UI-only local sends.',
      );
    }

    if (isLocal && allowLocalTracking) {
      this.logger.warn(
        `ALLOW_LOCAL_TRACKING is enabled — opens/clicks from external inboxes will not reach ${trackingBaseUrl}`,
      );
    }

    const probeResult = await probeTrackingOpenEndpoint(trackingBaseUrl, {
      localFallbackPort: this.configService.get<number>('port', 3008),
    });

    if (!probeResult.verified) {
      const suggestion = probeResult.suggestedTrackingBaseUrl
        ? ` Set TRACKING_BASE_URL=${probeResult.suggestedTrackingBaseUrl} and restart the backend.`
        : ' Verify TRACKING_BASE_URL points at the exact URL embedded in emails (usually {FRONTEND_URL}/api).';

      throw new BadRequestException(
        `Tracking open endpoint is not reachable at ${trackingBaseUrl}/track/open/…. ` +
          (probeResult.error ?? 'Unknown probe error.') +
          suggestion,
      );
    }

    if (probeResult.suggestedTrackingBaseUrl) {
      throw new BadRequestException(
        `TRACKING_BASE_URL is missing the /api proxy prefix. ` +
          `Set TRACKING_BASE_URL=${probeResult.suggestedTrackingBaseUrl}, restart the backend, and send a new test email.`,
      );
    }
  }
}
