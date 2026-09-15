import type { MailboxEntity } from '../mailboxes/entities/mailbox.entity';
import { CampaignSendService } from './campaign-send.service';
import * as trackingConfigUtil from './tracking-config.util';
import type { EmailCampaignMailboxSenderEntity } from './entities/email-campaign-mailbox-sender.entity';
import type { EmailCampaignRecipientEntity } from './entities/email-campaign-recipient.entity';
import type { EmailCampaignEntity } from './entities/email-campaign.entity';

describe('CampaignSendService.processCampaign', () => {
  const now = new Date('2026-08-24T10:00:00.000Z');
  const organizationId = 'org-1';
  const campaignId = 'campaign-1';
  const mailboxId = 'mailbox-1';

  let service: CampaignSendService;
  let saveCampaign: jest.Mock<
    Promise<EmailCampaignEntity>,
    [EmailCampaignEntity]
  >;
  let findReadyToSend: jest.Mock<
    Promise<EmailCampaignRecipientEntity[]>,
    [string, number, Date]
  >;
  let findStepOnePendingWithoutSchedule: jest.Mock<
    Promise<EmailCampaignRecipientEntity[]>,
    [string]
  >;
  let findFollowUpEligibleWithNextSendAt: jest.Mock<
    Promise<EmailCampaignRecipientEntity[]>,
    [string]
  >;
  let findFollowUpEligibleOnStepAndSendDate: jest.Mock<
    Promise<EmailCampaignRecipientEntity[]>,
    [string, number]
  >;
  let saveRecipient: jest.Mock<
    Promise<EmailCampaignRecipientEntity>,
    [EmailCampaignRecipientEntity]
  >;
  let findMailboxesByIds: jest.Mock<
    Promise<MailboxEntity[]>,
    [string[], string]
  >;
  let sendCampaignEmail: jest.Mock;
  let recordSent: jest.Mock;
  let recordSendFailed: jest.Mock;
  let saveMailboxSenders: jest.Mock;
  let saveMessage: jest.Mock;
  let removePendingMessage: jest.Mock;
  let sendOrder: string[];

  beforeEach(() => {
    jest
      .spyOn(trackingConfigUtil, 'probeTrackingOpenEndpoint')
      .mockResolvedValue({
        verified: true,
      });

    saveCampaign = jest
      .fn<Promise<EmailCampaignEntity>, [EmailCampaignEntity]>()
      .mockImplementation((campaign) => Promise.resolve(campaign));

    findReadyToSend = jest.fn<
      Promise<EmailCampaignRecipientEntity[]>,
      [string, number, Date]
    >();

    findStepOnePendingWithoutSchedule = jest
      .fn<Promise<EmailCampaignRecipientEntity[]>, [string]>()
      .mockResolvedValue([]);

    findFollowUpEligibleWithNextSendAt = jest
      .fn<Promise<EmailCampaignRecipientEntity[]>, [string]>()
      .mockResolvedValue([]);

    findFollowUpEligibleOnStepAndSendDate = jest
      .fn<Promise<EmailCampaignRecipientEntity[]>, [string, number]>()
      .mockResolvedValue([]);

    saveRecipient = jest
      .fn<
        Promise<EmailCampaignRecipientEntity>,
        [EmailCampaignRecipientEntity]
      >()
      .mockImplementation((recipient) => Promise.resolve(recipient));

    findMailboxesByIds = jest.fn<
      Promise<MailboxEntity[]>,
      [string[], string]
    >();

    sendCampaignEmail = jest.fn();
    recordSent = jest.fn().mockResolvedValue(undefined);
    recordSendFailed = jest.fn().mockResolvedValue(undefined);
    saveMailboxSenders = jest.fn().mockResolvedValue([]);
    sendOrder = [];
    saveMessage = jest.fn().mockImplementation((message: { id?: string }) => {
      sendOrder.push('saveMessage');
      message.id = 'message-1';
      return Promise.resolve(message);
    });
    removePendingMessage = jest.fn().mockResolvedValue(undefined);
    sendCampaignEmail.mockImplementation(() => {
      sendOrder.push('sendCampaignEmail');
      return Promise.resolve({ messageId: 'msg-1' });
    });

    service = new CampaignSendService(
      {
        save: saveCampaign,
        saveMailboxSenders,
      } as never,
      {
        findReadyToSend,
        findStepOnePendingWithoutSchedule,
        findFollowUpEligibleWithNextSendAt,
        findFollowUpEligibleOnStepAndSendDate,
        saveMany: jest.fn().mockResolvedValue([]),
        save: saveRecipient,
        countIncompleteByCampaignId: jest.fn().mockResolvedValue(1),
      } as never,
      {
        save: saveMessage,
        removePending: removePendingMessage,
      } as never,
      {
        findEmailsByOrganizationId: jest.fn().mockResolvedValue([]),
      } as never,
      {
        findByIdsAndOrganizationId: findMailboxesByIds,
      } as never,
      {
        sendCampaignEmail,
      } as never,
      {
        render: jest.fn((value: string) => value),
      } as never,
      {
        recordSent,
        recordSendFailed,
      } as never,
      {
        get: jest.fn().mockReturnValue('https://api.example.com'),
      } as never,
      {
        loadCampaignStepAttachmentBuffers: jest.fn().mockResolvedValue([]),
      } as never,
    );
  });

  function buildMailbox(overrides: Partial<MailboxEntity> = {}): MailboxEntity {
    return {
      id: mailboxId,
      organizationId,
      displayName: 'Sales',
      email: 'sales@example.com',
      provider: 'smtp',
      status: 'active',
      fromName: 'Sales Team',
      dailySendLimit: 4,
      dailySendsUsed: 0,
      dailySendsDate: '2026-08-24',
      warmupEnabled: false,
      syncStatus: 'connected',
      lastSyncedAt: now,
      smtpHost: 'smtp.example.com',
      smtpPort: 587,
      smtpUser: 'sales@example.com',
      smtpSecure: false,
      credentialsEncrypted: 'encrypted',
      createdAt: now,
      updatedAt: now,
      ...overrides,
    } as MailboxEntity;
  }

  function buildSender(
    overrides: Partial<EmailCampaignMailboxSenderEntity> = {},
  ): EmailCampaignMailboxSenderEntity {
    return {
      id: 'sender-1',
      campaignId,
      mailboxId,
      senderName: 'Sales Team',
      senderEmail: 'sales@example.com',
      signature: null,
      status: 'active',
      ...overrides,
    } as EmailCampaignMailboxSenderEntity;
  }

  function buildRecipient(
    index: number,
    overrides: Partial<EmailCampaignRecipientEntity> = {},
  ): EmailCampaignRecipientEntity {
    return {
      id: `recipient-${index}`,
      campaignId,
      email: `user${index}@example.com`,
      mergeFields: {},
      currentStepOrder: 1,
      status: 'pending',
      nextSendAt: null,
      lastSentAt: null,
      replyCategory: null,
      repliedAt: null,
      replySubject: null,
      contactDisposition: 'eligible',
      pausedUntil: null,
      allowSendDespiteReply: false,
      createdAt: now,
      ...overrides,
    } as EmailCampaignRecipientEntity;
  }

  function buildCampaign(
    overrides: Partial<EmailCampaignEntity> = {},
  ): EmailCampaignEntity {
    return {
      id: campaignId,
      organizationId,
      name: 'Test Campaign',
      goal: null,
      status: 'scheduled',
      campaignTypeId: null,
      brandId: null,
      regionId: null,
      audienceListType: 'contact',
      audienceListId: 'list-1',
      audienceCount: 5,
      launchAt: new Date('2026-08-24T00:00:00.000Z'),
      dailyBatchSize: 5,
      sendingWindowStartMinutes: 0,
      sendingWindowEndMinutes: 24 * 60 - 1,
      timezone: 'UTC',
      activeWeekdays: [0, 1, 2, 3, 4, 5, 6],
      estimatedEndAt: null,
      scheduledAt: now,
      sendsTodayCount: 0,
      sendsTodayDate: '2026-08-24',
      pausedUntil: null,
      statusBeforePause: null,
      createdAt: now,
      updatedAt: now,
      steps: [
        {
          id: 'step-1',
          campaignId,
          stepOrder: 1,
          subject: 'Hello',
          body: '<p>Hello</p>',
          delayDays: 0,
        },
      ],
      mailboxSenders: [buildSender()],
      ...overrides,
    } as EmailCampaignEntity;
  }

  it('sends one recipient per scheduler tick when capacity is available', async () => {
    const campaign = buildCampaign();
    const recipients = [buildRecipient(1)];

    findMailboxesByIds.mockResolvedValue([buildMailbox()]);
    findReadyToSend.mockResolvedValue(recipients);
    sendCampaignEmail.mockResolvedValue({ messageId: 'msg-1' });

    await service.processCampaign(campaign, now);

    expect(findReadyToSend).toHaveBeenCalledWith(campaignId, 1, now);
    expect(sendCampaignEmail).toHaveBeenCalledTimes(1);
    expect(recordSent).toHaveBeenCalledTimes(1);
    expect(recordSendFailed).not.toHaveBeenCalled();
    expect(campaign.sendsTodayCount).toBe(1);
  });

  it('uses another mailbox when the round-robin pick is at capacity', async () => {
    const fullMailboxId = 'mailbox-full';
    const availableMailboxId = 'mailbox-open';
    const campaign = buildCampaign({
      dailyBatchSize: 2,
      mailboxSenders: [
        buildSender({ id: 'sender-1', mailboxId: fullMailboxId }),
        buildSender({
          id: 'sender-2',
          mailboxId: availableMailboxId,
          senderEmail: 'open@example.com',
        }),
      ],
    });
    const recipients = [buildRecipient(1), buildRecipient(2)];

    findMailboxesByIds.mockResolvedValue([
      buildMailbox({
        id: fullMailboxId,
        dailySendLimit: 4,
        dailySendsUsed: 4,
      }),
      buildMailbox({
        id: availableMailboxId,
        email: 'open@example.com',
        dailySendLimit: 4,
        dailySendsUsed: 0,
      }),
    ]);
    findReadyToSend.mockResolvedValue([recipients[0]]);
    sendCampaignEmail.mockResolvedValue({ messageId: 'msg-1' });

    await service.processCampaign(campaign, now);

    expect(sendCampaignEmail).toHaveBeenCalledTimes(1);
    expect(sendCampaignEmail).toHaveBeenCalledWith(
      expect.objectContaining({ mailboxId: availableMailboxId }),
    );
    expect(campaign.sendsTodayCount).toBe(1);
  });

  it('stops sending when per-mailbox quota is reached', async () => {
    const campaign = buildCampaign({
      dailyBatchSize: 5,
      mailboxSenders: [
        buildSender({
          dailySendQuota: 2,
          sendsTodayCount: 0,
          sendsTodayDate: '2026-08-24',
        }),
      ],
    });
    const recipients = Array.from({ length: 5 }, (_, index) =>
      buildRecipient(index + 1),
    );

    findMailboxesByIds.mockResolvedValue([
      buildMailbox({ dailySendLimit: 50 }),
    ]);
    findReadyToSend.mockResolvedValue([recipients[0]]);
    sendCampaignEmail.mockResolvedValue({ messageId: 'msg-1' });

    await service.processCampaign(campaign, now);

    expect(findReadyToSend).toHaveBeenCalledWith(campaignId, 1, now);
    expect(sendCampaignEmail).toHaveBeenCalledTimes(1);
    expect(campaign.sendsTodayCount).toBe(1);
    expect(campaign.mailboxSenders[0].sendsTodayCount).toBe(1);
    expect(saveMailboxSenders).toHaveBeenCalled();
  });

  it('skips paused mailbox senders during round-robin', async () => {
    const pausedMailboxId = 'mailbox-paused';
    const activeMailboxId = 'mailbox-active';
    const campaign = buildCampaign({
      dailyBatchSize: 2,
      mailboxSenders: [
        buildSender({
          id: 'sender-1',
          mailboxId: pausedMailboxId,
          status: 'paused',
        }),
        buildSender({
          id: 'sender-2',
          mailboxId: activeMailboxId,
          senderEmail: 'active@example.com',
          status: 'active',
        }),
      ],
    });
    const recipients = [buildRecipient(1), buildRecipient(2)];

    findMailboxesByIds.mockResolvedValue([
      buildMailbox({
        id: pausedMailboxId,
        email: 'paused@example.com',
      }),
      buildMailbox({
        id: activeMailboxId,
        email: 'active@example.com',
      }),
    ]);
    findReadyToSend.mockResolvedValue([recipients[0]]);
    sendCampaignEmail.mockResolvedValue({ messageId: 'msg-1' });

    await service.processCampaign(campaign, now);

    expect(sendCampaignEmail).toHaveBeenCalledTimes(1);
    expect(sendCampaignEmail).toHaveBeenCalledWith(
      expect.objectContaining({ mailboxId: activeMailboxId }),
    );
    expect(sendCampaignEmail).not.toHaveBeenCalledWith(
      expect.objectContaining({ mailboxId: pausedMailboxId }),
    );
  });

  it('skips sending on inactive weekdays without changing campaign status', async () => {
    const saturday = new Date('2026-08-22T14:00:00.000Z');
    const campaign = buildCampaign({
      launchAt: new Date('2026-08-01T00:00:00.000Z'),
      timezone: 'America/New_York',
      activeWeekdays: [1, 2, 3, 4, 5],
      sendsTodayDate: '2026-08-22',
    });

    await service.processCampaign(campaign, saturday);

    expect(findReadyToSend).not.toHaveBeenCalled();
    expect(sendCampaignEmail).not.toHaveBeenCalled();
    expect(campaign.status).toBe('scheduled');
    expect(campaign.sendsTodayCount).toBe(0);
  });

  it('sends on weekdays when activeWeekdays are stored as strings', async () => {
    const monday = new Date('2026-08-24T12:33:00.000Z');
    const campaign = buildCampaign({
      launchAt: new Date('2026-08-24T12:30:00.000Z'),
      timezone: 'Asia/Calcutta',
      sendingWindowStartMinutes: 18 * 60,
      sendingWindowEndMinutes: 19 * 60,
      activeWeekdays: ['1', '2', '3', '4', '5'] as unknown as number[],
      sendsTodayDate: '2026-08-24',
    });
    const recipients = [buildRecipient(1)];

    findMailboxesByIds.mockResolvedValue([
      buildMailbox({ dailySendLimit: 50 }),
    ]);
    findReadyToSend.mockResolvedValue(recipients);
    sendCampaignEmail.mockResolvedValue({ messageId: 'msg-1' });

    await service.processCampaign(campaign, monday);

    expect(findReadyToSend).toHaveBeenCalledWith(campaignId, 1, monday);
    expect(sendCampaignEmail).toHaveBeenCalledTimes(1);
    expect(campaign.status).toBe('sending');
  });

  it('persists pending messages before SMTP send and records sent after success', async () => {
    const campaign = buildCampaign({ dailyBatchSize: 1 });
    const recipients = [buildRecipient(1)];

    findMailboxesByIds.mockResolvedValue([buildMailbox()]);
    findReadyToSend.mockResolvedValue(recipients);

    await service.processCampaign(campaign, now);

    expect(saveMessage).toHaveBeenCalledTimes(1);
    expect(saveMessage).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryStatus: 'pending' }),
    );
    expect(sendOrder.indexOf('saveMessage')).toBeLessThan(
      sendOrder.indexOf('sendCampaignEmail'),
    );
    expect(recordSent).toHaveBeenCalledTimes(1);
    expect(removePendingMessage).not.toHaveBeenCalled();
  });
});
