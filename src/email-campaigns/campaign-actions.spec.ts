import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CAMPAIGN_RESUME_REQUIRES_MAILBOX_MESSAGE } from './campaign-mailbox-sender-action.util';
import { EmailCampaignsService } from './email-campaigns.service';
import type { EmailCampaignEntity } from './entities/email-campaign.entity';
import type { EmailCampaignResponse } from './mappers/email-campaign.mapper';

describe('EmailCampaignsService campaign actions', () => {
  const campaignId = 'campaign-1';
  const organizationId = 'org-1';

  function buildCampaign(
    overrides: Partial<EmailCampaignEntity> = {},
  ): EmailCampaignEntity {
    return {
      id: campaignId,
      organizationId,
      name: 'Q3 Outreach',
      goal: null,
      status: 'scheduled',
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
      estimatedEndAt: new Date('2026-08-25T10:00:00Z'),
      scheduledAt: new Date('2026-08-15T10:00:00Z'),
      sendsTodayCount: 0,
      sendsTodayDate: null,
      pausedUntil: null,
      statusBeforePause: null,
      createdAt: new Date('2026-08-01T10:00:00Z'),
      updatedAt: new Date('2026-08-01T10:00:00Z'),
      organization: {} as EmailCampaignEntity['organization'],
      steps: [],
      mailboxSenders: [],
      ...overrides,
    };
  }

  function createService(campaign: EmailCampaignEntity | null) {
    let storedCampaign = campaign ? { ...campaign } : null;

    const emailCampaignsRepository = {
      findByIdAndOrganizationId: jest
        .fn<Promise<EmailCampaignEntity | null>, [string, string]>()
        .mockImplementation(() => Promise.resolve(storedCampaign)),
      save: jest
        .fn<Promise<EmailCampaignEntity>, [EmailCampaignEntity]>()
        .mockImplementation((entity) => {
          storedCampaign = { ...entity };
          return Promise.resolve(storedCampaign);
        }),
    };

    const emailCampaignMapper = {
      toResponse: jest
        .fn<EmailCampaignResponse, [EmailCampaignEntity]>()
        .mockImplementation((entity) => ({
          id: entity.id,
          name: entity.name,
          goal: entity.goal,
          status: entity.status,
          campaignTypeId: entity.campaignTypeId,
          brandId: entity.brandId,
          regionId: entity.regionId,
          audienceListType: entity.audienceListType,
          audienceListId: entity.audienceListId,
          audienceCount: entity.audienceCount,
          launchAt: entity.launchAt?.toISOString() ?? null,
          dailyBatchSize: entity.dailyBatchSize,
          sendingWindowStartMinutes: entity.sendingWindowStartMinutes,
          sendingWindowEndMinutes: entity.sendingWindowEndMinutes,
          timezone: entity.timezone,
          activeWeekdays: entity.activeWeekdays ?? [0, 1, 2, 3, 4, 5, 6],
          estimatedEndAt: entity.estimatedEndAt?.toISOString() ?? null,
          scheduledAt: entity.scheduledAt?.toISOString() ?? null,
          pausedUntil: entity.pausedUntil?.toISOString() ?? null,
          statusBeforePause: entity.statusBeforePause,
          steps: [],
          mailboxSenders: [],
          createdAt: entity.createdAt.toISOString(),
          updatedAt: entity.updatedAt.toISOString(),
        })),
    };

    const service = new EmailCampaignsService(
      emailCampaignsRepository as never,
      emailCampaignMapper as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {},
      {} as never,
      {} as never,
      {} as never,
      {
        resumePausedSendersForCampaign: jest
          .fn<Promise<void>, [EmailCampaignEntity, string]>()
          .mockResolvedValue(undefined),
      },
    );

    return {
      service,
      emailCampaignsRepository,
      getStoredCampaign: () => storedCampaign,
    };
  }

  it('pauseCampaign sets paused status, pausedUntil, and statusBeforePause', async () => {
    const { service, getStoredCampaign } = createService(
      buildCampaign({ status: 'scheduled' }),
    );
    const pausedUntil = new Date(Date.now() + 86_400_000).toISOString();

    const result = await service.pauseCampaign(
      campaignId,
      organizationId,
      pausedUntil,
    );

    expect(result.status).toBe('paused');
    const saved = getStoredCampaign();
    expect(saved?.status).toBe('paused');
    expect(saved?.statusBeforePause).toBe('scheduled');
    expect(saved?.pausedUntil).toEqual(new Date(pausedUntil));
  });

  it('pauseCampaign rejects draft campaigns', async () => {
    const { service } = createService(buildCampaign({ status: 'draft' }));

    await expect(
      service.pauseCampaign(
        campaignId,
        organizationId,
        new Date(Date.now() + 86_400_000).toISOString(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stopCampaign sets stopped status and clears pause fields', async () => {
    const { service, getStoredCampaign } = createService(
      buildCampaign({
        status: 'sending',
        statusBeforePause: 'sending',
        pausedUntil: new Date(Date.now() + 86_400_000),
      }),
    );

    const result = await service.stopCampaign(campaignId, organizationId);

    expect(result.status).toBe('stopped');
    const saved = getStoredCampaign();
    expect(saved?.status).toBe('stopped');
    expect(saved?.pausedUntil).toBeNull();
    expect(saved?.statusBeforePause).toBeNull();
  });

  it('stopCampaign rejects sent campaigns', async () => {
    const { service } = createService(buildCampaign({ status: 'sent' }));

    await expect(
      service.stopCampaign(campaignId, organizationId),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resumeCampaign restores statusBeforePause and clears pause fields', async () => {
    const { service, getStoredCampaign } = createService(
      buildCampaign({
        status: 'paused',
        statusBeforePause: 'sending',
        pausedUntil: new Date(Date.now() + 86_400_000),
      }),
    );

    const result = await service.resumeCampaign(campaignId, organizationId);

    expect(result.status).toBe('sending');
    const saved = getStoredCampaign();
    expect(saved?.status).toBe('sending');
    expect(saved?.pausedUntil).toBeNull();
    expect(saved?.statusBeforePause).toBeNull();
  });

  it('resumeCampaign rejects non-paused campaigns', async () => {
    const { service } = createService(buildCampaign({ status: 'scheduled' }));

    await expect(
      service.resumeCampaign(campaignId, organizationId),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects resuming campaign when only paused mailboxes remain', async () => {
    const { service } = createService(
      buildCampaign({
        status: 'paused',
        statusBeforePause: 'sending',
        pausedUntil: new Date(Date.now() + 86_400_000),
        mailboxSenders: [
          {
            id: 'sender-1',
            status: 'paused',
          },
        ],
      }),
    );

    await expect(
      service.resumeCampaign(campaignId, organizationId),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects resuming campaign when all mailbox senders are stopped', async () => {
    const { service } = createService(
      buildCampaign({
        status: 'paused',
        statusBeforePause: 'sending',
        pausedUntil: new Date(Date.now() + 86_400_000),
        mailboxSenders: [
          {
            id: 'sender-1',
            status: 'stopped',
          },
        ],
      }),
    );

    await expect(
      service.resumeCampaign(campaignId, organizationId),
    ).rejects.toThrow(CAMPAIGN_RESUME_REQUIRES_MAILBOX_MESSAGE);
  });

  it('throws NotFoundException for unknown campaign', async () => {
    const { service } = createService(null);

    await expect(
      service.pauseCampaign(
        campaignId,
        organizationId,
        new Date(Date.now() + 86_400_000).toISOString(),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
