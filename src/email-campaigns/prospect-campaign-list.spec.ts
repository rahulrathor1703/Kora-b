import { EmailCampaignRecipientsService } from './campaign-progress.service';
import type { EmailCampaignRecipientEntity } from './entities/email-campaign-recipient.entity';
import type { EmailCampaignEntity } from './entities/email-campaign.entity';
import type { CampaignRecipientResponse } from './mappers/campaign-recipient.mapper';

describe('EmailCampaignRecipientsService listByProspectEmail', () => {
  const organizationId = 'org-1';
  const prospectEmail = 'prospect@example.com';

  const scheduledCampaign = {
    id: 'campaign-1',
    organizationId,
    name: 'Q3 Outreach',
    status: 'sending',
    audienceListType: 'contact' as const,
    audienceListId: 'list-1',
    createdAt: new Date('2026-08-01T10:00:00Z'),
  };

  function createRecipient(
    campaign: typeof scheduledCampaign,
    email: string,
  ): EmailCampaignRecipientEntity {
    return {
      id: `recipient-${campaign.id}`,
      campaignId: campaign.id,
      email: email.toLowerCase(),
      mergeFields: {},
      currentStepOrder: 2,
      status: 'active',
      nextSendAt: null,
      lastSentAt: new Date('2026-08-19T10:00:00Z'),
      replyCategory: null,
      repliedAt: null,
      replySubject: null,
      contactDisposition: 'eligible',
      pausedUntil: null,
      allowSendDespiteReply: false,
      createdAt: new Date('2026-08-10T10:00:00Z'),
      campaign: campaign as EmailCampaignEntity,
    };
  }

  function createService(options?: {
    recipients?: EmailCampaignRecipientEntity[];
    excludedEmails?: string[];
  }) {
    const recipientsRepository = {
      findByEmailAndOrganizationId: jest
        .fn<Promise<EmailCampaignRecipientEntity[]>, [string, string]>()
        .mockResolvedValue(options?.recipients ?? []),
    };

    const messagesRepository = {
      findByCampaignIdAndRecipientIds: jest.fn().mockResolvedValue([
        {
          recipientId: 'recipient-campaign-1',
          campaignId: 'campaign-1',
          stepOrder: 1,
          deliveryStatus: 'sent',
          sentAt: new Date('2026-08-19T10:00:00Z'),
          openedAt: null,
          openCount: 0,
          clickedAt: null,
          clickCount: 0,
          bouncedAt: null,
          bounceReason: null,
        },
      ]),
    };

    const excludedRepository = {
      findEmailsByOrganizationId: jest
        .fn<Promise<string[]>, [string]>()
        .mockResolvedValue(options?.excludedEmails ?? []),
    };

    const mappedRecipient: CampaignRecipientResponse = {
      id: 'recipient-campaign-1',
      email: prospectEmail,
      status: 'active',
      currentStepOrder: 2,
      lastSentAt: '2026-08-19T10:00:00.000Z',
      replyCategory: null,
      repliedAt: null,
      contactDisposition: 'eligible',
      pausedUntil: null,
      allowSendDespiteReply: false,
      globallyExcluded: false,
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
    };

    const campaignRecipientMapper = {
      toResponse: jest.fn().mockReturnValue(mappedRecipient),
    };

    const service = new EmailCampaignRecipientsService(
      {} as EmailCampaignRecipientsService['emailCampaignsRepository'],
      recipientsRepository as EmailCampaignRecipientsService['recipientsRepository'],
      messagesRepository as EmailCampaignRecipientsService['messagesRepository'],
      excludedRepository as EmailCampaignRecipientsService['excludedRepository'],
      campaignRecipientMapper as EmailCampaignRecipientsService['campaignRecipientMapper'],
    );

    return {
      service,
      recipientsRepository,
      messagesRepository,
      campaignRecipientMapper,
    };
  }

  it('returns empty list when email is blank', async () => {
    const { service, recipientsRepository } = createService();

    const result = await service.listByProspectEmail(organizationId, '   ');

    expect(result).toEqual({ items: [], total: 0 });
    expect(
      recipientsRepository.findByEmailAndOrganizationId,
    ).not.toHaveBeenCalled();
  });

  it('returns empty list when no recipients match the email', async () => {
    const { service } = createService({ recipients: [] });

    const result = await service.listByProspectEmail(
      organizationId,
      prospectEmail,
    );

    expect(result).toEqual({ items: [], total: 0 });
  });

  it('returns campaign summaries with mapped recipient engagement', async () => {
    const recipient = createRecipient(scheduledCampaign, prospectEmail);
    const { service, campaignRecipientMapper } = createService({
      recipients: [recipient],
    });

    const result = await service.listByProspectEmail(
      organizationId,
      prospectEmail,
    );

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      campaignId: scheduledCampaign.id,
      campaignName: scheduledCampaign.name,
      campaignStatus: scheduledCampaign.status,
      audienceListType: scheduledCampaign.audienceListType,
      audienceListId: scheduledCampaign.audienceListId,
    });
    expect(result.items[0]?.recipient.id).toBe('recipient-campaign-1');
    expect(result.items[0]?.recipient.email).toBe(prospectEmail);
    expect(campaignRecipientMapper.toResponse).toHaveBeenCalledWith(
      recipient,
      expect.any(Array),
      false,
    );
  });

  it('normalizes email before querying recipients', async () => {
    const recipient = createRecipient(scheduledCampaign, prospectEmail);
    const { service, recipientsRepository } = createService({
      recipients: [recipient],
    });

    await service.listByProspectEmail(
      organizationId,
      '  Prospect@Example.com  ',
    );

    expect(
      recipientsRepository.findByEmailAndOrganizationId,
    ).toHaveBeenCalledWith(organizationId, 'prospect@example.com');
  });
});
