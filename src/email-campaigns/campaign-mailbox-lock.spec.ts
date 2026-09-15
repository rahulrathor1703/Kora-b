import { BadRequestException } from '@nestjs/common';
import {
  buildMailboxConflictMessage,
  isMailboxLockingCampaignStatus,
} from './campaign-mailbox-lock.util';
import { EmailCampaignsService } from './email-campaigns.service';
import type { EmailCampaignMailboxSenderEntity } from './entities/email-campaign-mailbox-sender.entity';
import type { EmailCampaignEntity } from './entities/email-campaign.entity';
import type { EmailCampaignResponse } from './mappers/email-campaign.mapper';

describe('campaign-mailbox-lock', () => {
  describe('buildMailboxConflictMessage', () => {
    it('includes mailbox label and campaign name', () => {
      expect(buildMailboxConflictMessage('sales@acme.com', 'Q3 Outreach')).toBe(
        '"sales@acme.com" is already sending from "Q3 Outreach". Pause, stop, or complete that campaign before using this mailbox.',
      );
    });
  });

  describe('isMailboxLockingCampaignStatus', () => {
    it('returns true for scheduled and sending', () => {
      expect(isMailboxLockingCampaignStatus('scheduled')).toBe(true);
      expect(isMailboxLockingCampaignStatus('sending')).toBe(true);
    });

    it('returns false for draft, paused, stopped, and sent', () => {
      expect(isMailboxLockingCampaignStatus('draft')).toBe(false);
      expect(isMailboxLockingCampaignStatus('paused')).toBe(false);
      expect(isMailboxLockingCampaignStatus('stopped')).toBe(false);
      expect(isMailboxLockingCampaignStatus('sent')).toBe(false);
    });
  });
});

describe('EmailCampaignsService mailbox exclusivity', () => {
  const campaignId = 'campaign-2';
  const organizationId = 'org-1';
  const mailboxId = 'mailbox-1';

  function buildSender(
    overrides: Partial<EmailCampaignMailboxSenderEntity> = {},
  ): EmailCampaignMailboxSenderEntity {
    return {
      id: 'sender-1',
      campaignId,
      mailboxId,
      senderName: 'Sales Team',
      senderEmail: 'sales@acme.com',
      signature: null,
      campaign: {} as EmailCampaignMailboxSenderEntity['campaign'],
      ...overrides,
    };
  }

  function buildCampaign(
    overrides: Partial<EmailCampaignEntity> = {},
  ): EmailCampaignEntity {
    return {
      id: campaignId,
      organizationId,
      name: 'New Campaign',
      goal: null,
      status: 'draft',
      campaignTypeId: null,
      brandId: null,
      regionId: null,
      customFieldValues: {},
      audienceListType: 'contact',
      audienceListId: 'list-1',
      audienceCount: 0,
      launchAt: null,
      dailyBatchSize: 50,
      sendingWindowStartMinutes: null,
      sendingWindowEndMinutes: null,
      timezone: null,
      activeWeekdays: null,
      estimatedEndAt: null,
      scheduledAt: null,
      sendsTodayCount: 0,
      sendsTodayDate: null,
      pausedUntil: null,
      statusBeforePause: null,
      createdAt: new Date('2026-08-01T10:00:00Z'),
      updatedAt: new Date('2026-08-01T10:00:00Z'),
      organization: {} as EmailCampaignEntity['organization'],
      steps: [
        {
          id: 'step-1',
          campaignId,
          stepOrder: 1,
          subject: 'Hello',
          body: 'Body',
          delayMode: 'relative',
          delayDays: 0,
          scheduledDate: null,
          campaign: {} as EmailCampaignEntity['steps'][number]['campaign'],
        },
      ],
      mailboxSenders: [buildSender()],
      ...overrides,
    };
  }

  function createService(options?: {
    campaign?: EmailCampaignEntity | null;
    activeMailboxUsage?: Array<{
      mailboxId: string;
      campaignId: string;
      campaignName: string;
    }>;
  }) {
    let storedCampaign = options?.campaign ? { ...options.campaign } : null;

    const emailCampaignsRepository = {
      findByIdAndOrganizationId: jest
        .fn<Promise<EmailCampaignEntity | null>, [string, string]>()
        .mockImplementation(() => Promise.resolve(storedCampaign)),
      findActiveMailboxUsage: jest
        .fn<
          Promise<
            Array<{
              mailboxId: string;
              campaignId: string;
              campaignName: string;
            }>
          >,
          [string, string[], string | undefined]
        >()
        .mockResolvedValue(options?.activeMailboxUsage ?? []),
      create: jest
        .fn<EmailCampaignEntity, [Partial<EmailCampaignEntity>]>()
        .mockImplementation((data) => data as EmailCampaignEntity),
      save: jest
        .fn<Promise<EmailCampaignEntity>, [EmailCampaignEntity]>()
        .mockImplementation((entity) => {
          storedCampaign = { ...entity };
          return Promise.resolve(storedCampaign);
        }),
      replaceChildCollections: jest.fn<Promise<void>, [string, never, never]>(),
      scheduleCampaignWithRecipients: jest
        .fn<Promise<EmailCampaignEntity>, [EmailCampaignEntity, never[]]>()
        .mockImplementation((campaign) => Promise.resolve(campaign)),
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
          customFieldValues: entity.customFieldValues ?? {},
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

    const mailboxesRepository = {
      findByIdAndOrganizationId: jest
        .fn<Promise<{ id: string; email: string } | null>, [string, string]>()
        .mockResolvedValue({ id: mailboxId, email: 'sales@acme.com' }),
    };

    const campaignCustomFieldsService = {
      validateAndNormalizeCustomFieldValues: jest
        .fn<
          Promise<Record<string, string>>,
          [Record<string, string> | undefined, string]
        >()
        .mockResolvedValue({}),
    };

    const orgQuotaService = {
      assertWithinLimit: jest.fn().mockResolvedValue(undefined),
    };

    const service = new EmailCampaignsService(
      emailCampaignsRepository as never,
      emailCampaignMapper as never,
      {} as never,
      mailboxesRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      campaignCustomFieldsService as never,
      orgQuotaService as never,
    );

    return { service, emailCampaignsRepository };
  }

  it('rejects create when mailbox is used by another active campaign', async () => {
    const { service } = createService({
      activeMailboxUsage: [
        {
          mailboxId,
          campaignId: 'campaign-1',
          campaignName: 'Q3 Outreach',
        },
      ],
    });

    await expect(
      service.create(
        {
          name: 'New Campaign',
          steps: [
            {
              stepOrder: 1,
              subject: 'Hello',
              body: 'Body',
              delayDays: 0,
            },
          ],
          mailboxSenders: [
            {
              mailboxId,
              senderName: 'Sales',
              senderEmail: 'sales@acme.com',
            },
          ],
        },
        organizationId,
      ),
    ).rejects.toThrow(
      new BadRequestException(
        buildMailboxConflictMessage('sales@acme.com', 'Q3 Outreach'),
      ),
    );
  });

  it('rejects update when mailbox is used by another active campaign', async () => {
    const { service } = createService({
      campaign: buildCampaign(),
      activeMailboxUsage: [
        {
          mailboxId,
          campaignId: 'campaign-1',
          campaignName: 'Q3 Outreach',
        },
      ],
    });

    await expect(
      service.update(
        campaignId,
        {
          mailboxSenders: [
            {
              mailboxId,
              senderName: 'Sales',
              senderEmail: 'sales@acme.com',
            },
          ],
        },
        organizationId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('passes excludeCampaignId when updating mailboxes on an existing campaign', async () => {
    const { service, emailCampaignsRepository } = createService({
      campaign: buildCampaign(),
      activeMailboxUsage: [],
    });

    await expect(
      service.update(
        campaignId,
        {
          mailboxSenders: [
            {
              mailboxId,
              senderName: 'Sales',
              senderEmail: 'sales@acme.com',
            },
          ],
        },
        organizationId,
      ),
    ).resolves.toBeDefined();

    expect(
      emailCampaignsRepository.findActiveMailboxUsage,
    ).toHaveBeenCalledWith(organizationId, [mailboxId], campaignId);
  });

  it('rejects schedule when assigned mailboxes conflict with another active campaign', async () => {
    const { service } = createService({
      campaign: buildCampaign(),
      activeMailboxUsage: [
        {
          mailboxId,
          campaignId: 'campaign-1',
          campaignName: 'Q3 Outreach',
        },
      ],
    });

    await expect(
      service.schedule(
        campaignId,
        {
          launchAt: '2026-09-01',
          dailyBatchSize: 50,
          sendingWindowStartMinutes: 540,
          sendingWindowEndMinutes: 1020,
          timezone: 'America/New_York',
          activeWeekdays: [1, 2, 3, 4, 5],
        },
        organizationId,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
