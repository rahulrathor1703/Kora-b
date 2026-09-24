import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CampaignMailboxSendersService } from './campaign-mailbox-senders.service';
import type { EmailCampaignMailboxSenderEntity } from './entities/email-campaign-mailbox-sender.entity';
import type { EmailCampaignEntity } from './entities/email-campaign.entity';

describe('CampaignMailboxSendersService', () => {
  const campaignId = 'campaign-1';
  const organizationId = 'org-1';
  const mailboxId1 = 'mailbox-1';
  const mailboxId2 = 'mailbox-2';

  function buildSender(
    overrides: Partial<EmailCampaignMailboxSenderEntity> = {},
  ): EmailCampaignMailboxSenderEntity {
    return {
      id: overrides.id ?? 'sender-1',
      campaignId,
      mailboxId: mailboxId1,
      senderName: 'Sales Team',
      senderEmail: 'sales@example.com',
      signature: null,
      dailySendQuota: 25,
      sendsTodayCount: 3,
      sendsTodayDate: '2026-08-24',
      status: 'active',
      ...overrides,
    } as EmailCampaignMailboxSenderEntity;
  }

  function buildCampaign(
    overrides: Partial<EmailCampaignEntity> = {},
  ): EmailCampaignEntity {
    return {
      id: campaignId,
      organizationId,
      name: 'Q3 Outreach',
      goal: null,
      status: 'sending',
      campaignTypeId: null,
      brandId: null,
      regionId: null,
      audienceListType: 'contact',
      audienceListId: 'list-1',
      audienceCount: 10,
      launchAt: new Date('2026-08-20T10:00:00Z'),
      dailyBatchSize: 50,
      sendingWindowStartMinutes: 540,
      sendingWindowEndMinutes: 1020,
      timezone: 'America/New_York',
      activeWeekdays: [0, 1, 2, 3, 4, 5, 6],
      estimatedEndAt: null,
      scheduledAt: new Date('2026-08-15T10:00:00Z'),
      sendsTodayCount: 5,
      sendsTodayDate: '2026-08-24',
      pausedUntil: null,
      statusBeforePause: null,
      wizardStepIndex: null,
      customFieldValues: {},
      createdAt: new Date('2026-08-01T10:00:00Z'),
      updatedAt: new Date('2026-08-01T10:00:00Z'),
      organization: {} as EmailCampaignEntity['organization'],
      steps: [],
      mailboxSenders: [
        buildSender({ id: 'sender-1' }),
        buildSender({
          id: 'sender-2',
          mailboxId: mailboxId2,
          senderEmail: 'open@example.com',
        }),
      ],
      ...overrides,
    };
  }

  function createService(campaign: EmailCampaignEntity | null) {
    let storedCampaign = campaign ? structuredClone(campaign) : null;
    let savedSender: EmailCampaignMailboxSenderEntity | null = null;

    const emailCampaignsRepository = {
      findByIdAndOrganizationId: jest
        .fn<Promise<EmailCampaignEntity | null>, [string, string]>()
        .mockImplementation(() => Promise.resolve(storedCampaign)),
      saveMailboxSender: jest
        .fn<
          Promise<EmailCampaignMailboxSenderEntity>,
          [EmailCampaignMailboxSenderEntity]
        >()
        .mockImplementation((sender) => {
          savedSender = { ...sender };

          if (storedCampaign) {
            storedCampaign = {
              ...storedCampaign,
              mailboxSenders: storedCampaign.mailboxSenders.map((candidate) =>
                candidate.id === sender.id ? savedSender! : candidate,
              ),
            };
          }

          return Promise.resolve(savedSender);
        }),
      findActiveMailboxUsage: jest.fn().mockResolvedValue([]),
      save: jest
        .fn<Promise<EmailCampaignEntity>, [EmailCampaignEntity]>()
        .mockImplementation((campaign) => {
          storedCampaign = structuredClone(campaign);
          return Promise.resolve(storedCampaign);
        }),
    };

    const mailboxesRepository = {
      findByIdAndOrganizationId: jest.fn().mockImplementation((id: string) =>
        Promise.resolve({
          id,
          email: id === mailboxId1 ? 'sales@example.com' : 'open@example.com',
          status: 'active',
          dailySendLimit: 100,
        }),
      ),
    };

    const emailCampaignMapper = {
      toResponse: jest
        .fn()
        .mockImplementation((entity: EmailCampaignEntity) => ({
          id: entity.id,
          status: entity.status,
          mailboxSenders: entity.mailboxSenders,
        })),
    };

    const service = new CampaignMailboxSendersService(
      emailCampaignsRepository as never,
      mailboxesRepository as never,
      emailCampaignMapper as never,
    );

    return {
      service,
      emailCampaignsRepository,
      mailboxesRepository,
      getStoredCampaign: () => storedCampaign,
      getSavedSender: () => savedSender,
    };
  }

  it('pauses an active mailbox sender', async () => {
    const { service, getSavedSender } = createService(buildCampaign());

    const result = await service.pauseSender(
      campaignId,
      'sender-1',
      organizationId,
    );

    expect(getSavedSender()?.status).toBe('paused');
    expect(result.status).toBe('sending');
  });

  it('rejects pausing the last active mailbox sender without pausing campaign', async () => {
    const { service } = createService(
      buildCampaign({
        mailboxSenders: [buildSender({ id: 'sender-1' })],
      }),
    );

    await expect(
      service.pauseSender(campaignId, 'sender-1', organizationId),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('pauses the last active mailbox sender and campaign together', async () => {
    const { service, getSavedSender, getStoredCampaign } = createService(
      buildCampaign({
        mailboxSenders: [buildSender({ id: 'sender-1' })],
      }),
    );

    const result = await service.pauseSender(
      campaignId,
      'sender-1',
      organizationId,
      {
        pauseCampaign: true,
        pausedUntil: '2026-12-01T23:59:59.999Z',
      },
    );

    expect(getSavedSender()?.status).toBe('paused');
    expect(getStoredCampaign()?.status).toBe('paused');
    expect(getStoredCampaign()?.statusBeforePause).toBe('sending');
    expect(result.status).toBe('paused');
  });

  it('allows pausing the last active mailbox sender when campaign is already paused', async () => {
    const { service, getSavedSender } = createService(
      buildCampaign({
        status: 'paused',
        statusBeforePause: 'sending',
        mailboxSenders: [buildSender({ id: 'sender-1' })],
      }),
    );

    await service.pauseSender(campaignId, 'sender-1', organizationId);

    expect(getSavedSender()?.status).toBe('paused');
  });

  it('resumes a paused mailbox sender', async () => {
    const { service, getSavedSender } = createService(
      buildCampaign({
        mailboxSenders: [
          buildSender({ id: 'sender-1', status: 'paused' }),
          buildSender({ id: 'sender-2', mailboxId: mailboxId2 }),
        ],
      }),
    );

    await service.resumeSender(campaignId, 'sender-1', organizationId);

    expect(getSavedSender()?.status).toBe('active');
  });

  it('stops an active mailbox sender when another remains active', async () => {
    const { service, getSavedSender } = createService(buildCampaign());

    await service.stopSender(campaignId, 'sender-1', organizationId);

    expect(getSavedSender()?.status).toBe('stopped');
  });

  it('rejects stopping the last active mailbox sender without pausing campaign', async () => {
    const { service } = createService(
      buildCampaign({
        mailboxSenders: [buildSender({ id: 'sender-1' })],
      }),
    );

    await expect(
      service.stopSender(campaignId, 'sender-1', organizationId),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stops the last active mailbox sender and pauses the campaign', async () => {
    const { service, getSavedSender, getStoredCampaign } = createService(
      buildCampaign({
        mailboxSenders: [buildSender({ id: 'sender-1' })],
      }),
    );

    const result = await service.stopSender(
      campaignId,
      'sender-1',
      organizationId,
      { pauseCampaign: true },
    );

    expect(getSavedSender()?.status).toBe('stopped');
    expect(getStoredCampaign()?.status).toBe('paused');
    expect(getStoredCampaign()?.pausedUntil).toBeNull();
    expect(result.status).toBe('paused');
  });

  it('adds a new active mailbox sender', async () => {
    const { service, getSavedSender, emailCampaignsRepository } = createService(
      buildCampaign({
        mailboxSenders: [
          buildSender({ id: 'sender-1', dailySendQuota: 20 }),
          buildSender({
            id: 'sender-2',
            mailboxId: mailboxId2,
            dailySendQuota: 20,
          }),
        ],
      }),
    );

    await service.addSender(
      campaignId,
      {
        mailboxId: 'mailbox-3',
        senderName: 'Support',
        senderEmail: 'support@example.com',
        dailySendQuota: 5,
      },
      organizationId,
    );

    expect(emailCampaignsRepository.saveMailboxSender).toHaveBeenCalled();
    expect(getSavedSender()?.status).toBe('active');
    expect(getSavedSender()?.sendsTodayCount).toBe(0);
  });

  it('resets sender counters when mailbox is swapped', async () => {
    const { service, getSavedSender } = createService(buildCampaign());

    await service.updateSender(
      campaignId,
      'sender-1',
      { mailboxId: 'mailbox-3' },
      organizationId,
    );

    expect(getSavedSender()?.mailboxId).toBe('mailbox-3');
    expect(getSavedSender()?.sendsTodayCount).toBe(0);
    expect(getSavedSender()?.sendsTodayDate).toBeNull();
  });

  it('preserves sender counters when only config changes', async () => {
    const { service, getSavedSender } = createService(buildCampaign());

    await service.updateSender(
      campaignId,
      'sender-1',
      { senderName: 'Updated Name' },
      organizationId,
    );

    expect(getSavedSender()?.senderName).toBe('Updated Name');
    expect(getSavedSender()?.sendsTodayCount).toBe(3);
    expect(getSavedSender()?.sendsTodayDate).toBe('2026-08-24');
  });

  it('rejects mailbox management on draft campaigns', async () => {
    const { service } = createService(buildCampaign({ status: 'draft' }));

    await expect(
      service.pauseSender(campaignId, 'sender-1', organizationId),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when sender is not found', async () => {
    const { service } = createService(buildCampaign());

    await expect(
      service.pauseSender(campaignId, 'missing-sender', organizationId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
