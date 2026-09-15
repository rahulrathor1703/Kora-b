import { BadRequestException } from '@nestjs/common';
import { EmailCampaignRecipientsService } from './campaign-progress.service';
import type { EmailCampaignRecipientEntity } from './entities/email-campaign-recipient.entity';
import type { CampaignRecipientResponse } from './mappers/campaign-recipient.mapper';

describe('EmailCampaignRecipientsService exclusion', () => {
  const campaignId = 'campaign-1';
  const organizationId = 'org-1';

  const campaign = {
    id: campaignId,
    organizationId,
    name: 'Q3 Outreach',
    audienceListId: 'list-1',
    audienceListType: 'contact',
    status: 'scheduled',
  };

  function buildRecipient(
    overrides: Partial<EmailCampaignRecipientEntity> = {},
  ): EmailCampaignRecipientEntity {
    return {
      id: 'recipient-1',
      campaignId,
      email: 'jane@example.com',
      mergeFields: {},
      currentStepOrder: 2,
      status: 'active',
      nextSendAt: new Date('2026-08-17T10:00:00Z'),
      lastSentAt: new Date('2026-08-16T10:00:00Z'),
      replyCategory: null,
      repliedAt: null,
      replySubject: null,
      contactDisposition: 'eligible',
      createdAt: new Date('2026-08-15T10:00:00Z'),
      campaign: {} as EmailCampaignRecipientEntity['campaign'],
      ...overrides,
    };
  }

  function createService(recipient: EmailCampaignRecipientEntity) {
    const savedRecipient = { ...recipient };

    const emailCampaignsRepository = {
      findByIdAndOrganizationId: jest
        .fn<Promise<typeof campaign | null>, [string, string]>()
        .mockResolvedValue(campaign),
    };

    const recipientsRepository = {
      findByIdAndCampaignId: jest
        .fn<Promise<EmailCampaignRecipientEntity | null>, [string, string]>()
        .mockResolvedValue(recipient),
      save: jest
        .fn<
          Promise<EmailCampaignRecipientEntity>,
          [EmailCampaignRecipientEntity]
        >()
        .mockImplementation((entity) => {
          Object.assign(savedRecipient, entity);
          return Promise.resolve(savedRecipient);
        }),
    };

    const messagesRepository = {
      findByCampaignIdAndRecipientIds: jest
        .fn<Promise<[]>, [string, string[]]>()
        .mockResolvedValue([]),
    };

    const campaignRecipientMapper = {
      toResponse: jest
        .fn<CampaignRecipientResponse, [EmailCampaignRecipientEntity, []]>()
        .mockImplementation((entity) => ({
          id: entity.id,
          email: entity.email,
          contactDisposition: entity.contactDisposition,
          currentStepOrder: entity.currentStepOrder,
          lastSentAt: entity.lastSentAt?.toISOString() ?? null,
          status: entity.status,
          replyCategory: entity.replyCategory,
          repliedAt: entity.repliedAt?.toISOString() ?? null,
          engagement: {
            status: 'sent',
            latestDeliveryStatus: 'sent',
            opened: false,
            openedAt: null,
            openCount: 0,
            clicked: false,
            clickedAt: null,
            clickCount: 0,
            bounced: false,
            bouncedAt: null,
            bounceReason: null,
          },
          messages: [],
        })),
    };

    const service = new EmailCampaignRecipientsService(
      emailCampaignsRepository as never,
      recipientsRepository as never,
      messagesRepository as never,
      {
        findByOrganizationIdAndEmail: jest.fn().mockResolvedValue(null),
      } as never,
      campaignRecipientMapper as never,
    );

    return {
      service,
      savedRecipient,
    };
  }

  it('excludes an eligible recipient and clears nextSendAt', async () => {
    const recipient = buildRecipient();
    const { service, savedRecipient } = createService(recipient);

    const response = await service.updateRecipient(
      campaignId,
      recipient.id,
      organizationId,
      { contactDisposition: 'excluded' },
    );

    expect(savedRecipient.contactDisposition).toBe('excluded');
    expect(savedRecipient.nextSendAt).toBeNull();
    expect(response.contactDisposition).toBe('excluded');
  });

  it('re-includes an excluded recipient', async () => {
    const recipient = buildRecipient({
      contactDisposition: 'excluded',
      nextSendAt: null,
    });
    const { service, savedRecipient } = createService(recipient);

    const response = await service.updateRecipient(
      campaignId,
      recipient.id,
      organizationId,
      { contactDisposition: 'eligible' },
    );

    expect(savedRecipient.contactDisposition).toBe('eligible');
    expect(response.contactDisposition).toBe('eligible');
  });

  it('rejects excluding an unsubscribed recipient', async () => {
    const recipient = buildRecipient({ contactDisposition: 'unsubscribed' });
    const { service } = createService(recipient);

    await expect(
      service.updateRecipient(campaignId, recipient.id, organizationId, {
        contactDisposition: 'excluded',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects re-including a non-excluded recipient', async () => {
    const recipient = buildRecipient({ contactDisposition: 'paused' });
    const { service } = createService(recipient);

    await expect(
      service.updateRecipient(campaignId, recipient.id, organizationId, {
        contactDisposition: 'eligible',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('excludeRecipient delegates to excluded disposition update', async () => {
    const recipient = buildRecipient();
    const { service, savedRecipient } = createService(recipient);

    await service.excludeRecipient(campaignId, recipient.id, organizationId);

    expect(savedRecipient.contactDisposition).toBe('excluded');
    expect(savedRecipient.nextSendAt).toBeNull();
  });

  it('includeRecipient delegates to eligible disposition update', async () => {
    const recipient = buildRecipient({
      contactDisposition: 'excluded',
      nextSendAt: null,
    });
    const { service, savedRecipient } = createService(recipient);

    await service.includeRecipient(campaignId, recipient.id, organizationId);

    expect(savedRecipient.contactDisposition).toBe('eligible');
  });
});
