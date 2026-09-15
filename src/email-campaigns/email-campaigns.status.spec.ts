import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EmailCampaignsService } from './email-campaigns.service';
import type { EmailCampaignEntity } from './entities/email-campaign.entity';
import type { EmailCampaignResponse } from './mappers/email-campaign.mapper';

describe('EmailCampaignsService.updateStatus', () => {
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
      status: 'draft',
      campaignTypeId: null,
      brandId: null,
      regionId: null,
      audienceListType: 'contact',
      audienceListId: 'list-1',
      audienceCount: 0,
      launchAt: null,
      dailyBatchSize: 50,
      sendingWindowStartMinutes: null,
      sendingWindowEndMinutes: null,
      timezone: null,
      estimatedEndAt: null,
      scheduledAt: null,
      sendsTodayCount: 0,
      sendsTodayDate: null,
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
      resetToDraft: jest
        .fn<Promise<EmailCampaignEntity>, [EmailCampaignEntity]>()
        .mockImplementation((entity) => {
          storedCampaign = {
            ...entity,
            status: 'draft',
            launchAt: null,
            scheduledAt: null,
            estimatedEndAt: null,
            timezone: null,
            sendingWindowStartMinutes: null,
            sendingWindowEndMinutes: null,
            dailyBatchSize: 50,
            audienceCount: 0,
            sendsTodayCount: 0,
            sendsTodayDate: null,
          };
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
      {} as never,
    );

    return {
      service,
      emailCampaignsRepository,
      emailCampaignMapper,
      getStoredCampaign: () => storedCampaign,
    };
  }

  it('updates status for a valid transition', async () => {
    const { service, emailCampaignsRepository } = createService(
      buildCampaign({ status: 'draft' }),
    );

    const result = await service.updateStatus(
      campaignId,
      { status: 'scheduled' },
      organizationId,
    );

    expect(result.status).toBe('scheduled');
    expect(emailCampaignsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'scheduled' }),
    );
  });

  it('returns current campaign when status is unchanged', async () => {
    const { service, emailCampaignsRepository } = createService(
      buildCampaign({ status: 'draft' }),
    );

    const result = await service.updateStatus(
      campaignId,
      { status: 'draft' },
      organizationId,
    );

    expect(result.status).toBe('draft');
    expect(emailCampaignsRepository.save).not.toHaveBeenCalled();
    expect(emailCampaignsRepository.resetToDraft).not.toHaveBeenCalled();
  });

  it('resets schedule fields and deletes recipients when moving to draft', async () => {
    const { service, emailCampaignsRepository } = createService(
      buildCampaign({
        status: 'scheduled',
        launchAt: new Date('2026-08-20T10:00:00Z'),
        scheduledAt: new Date('2026-08-15T10:00:00Z'),
        estimatedEndAt: new Date('2026-08-25T10:00:00Z'),
        timezone: 'America/New_York',
        sendingWindowStartMinutes: 540,
        sendingWindowEndMinutes: 1020,
        audienceCount: 42,
      }),
    );

    const result = await service.updateStatus(
      campaignId,
      { status: 'draft' },
      organizationId,
    );

    expect(result.status).toBe('draft');
    expect(emailCampaignsRepository.resetToDraft).toHaveBeenCalledWith(
      expect.objectContaining({ id: campaignId }),
    );
    expect(emailCampaignsRepository.save).not.toHaveBeenCalled();
  });

  it('throws NotFoundException for unknown campaign', async () => {
    const { service } = createService(null);

    await expect(
      service.updateStatus(campaignId, { status: 'scheduled' }, organizationId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects transitions to system-managed statuses', async () => {
    const { service, emailCampaignsRepository } = createService(
      buildCampaign({ status: 'draft' }),
    );

    await expect(
      service.updateStatus(campaignId, { status: 'sent' }, organizationId),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(emailCampaignsRepository.save).not.toHaveBeenCalled();
  });

  it('rejects transitions from system-managed statuses', async () => {
    const { service, emailCampaignsRepository } = createService(
      buildCampaign({ status: 'sending' }),
    );

    await expect(
      service.updateStatus(campaignId, { status: 'draft' }, organizationId),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(emailCampaignsRepository.save).not.toHaveBeenCalled();
    expect(emailCampaignsRepository.resetToDraft).not.toHaveBeenCalled();
  });
});
