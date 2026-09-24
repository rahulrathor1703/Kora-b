import { BadRequestException } from '@nestjs/common';
import { EmailCampaignRecipientsService } from './campaign-progress.service';
import type { EmailCampaignRecipientEntity } from './entities/email-campaign-recipient.entity';
import type { CampaignRecipientResponse } from './mappers/campaign-recipient.mapper';

describe('EmailCampaignRecipientsService addRecipient', () => {
  const campaignId = 'campaign-1';
  const organizationId = 'org-1';

  const sendingCampaign = {
    id: campaignId,
    organizationId,
    name: 'Q3 Outreach',
    audienceListId: 'list-1',
    audienceListType: 'contact' as const,
    status: 'sending' as const,
    audienceCount: 10,
  };

  function createService(options?: {
    campaign?: typeof sendingCampaign;
    existingRecipient?: EmailCampaignRecipientEntity | null;
    excludedEmail?: boolean;
  }) {
    const campaign = options?.campaign ?? sendingCampaign;

    const emailCampaignsRepository = {
      findByIdAndOrganizationId: jest
        .fn<Promise<typeof campaign | null>, [string, string]>()
        .mockResolvedValue(campaign),
      addCampaignRecipient: jest
        .fn<
          Promise<{
            campaign: typeof campaign;
            recipient: EmailCampaignRecipientEntity;
          }>,
          [typeof campaign, EmailCampaignRecipientEntity]
        >()
        .mockImplementation((_campaign, recipient) => {
          const savedRecipient = {
            ...recipient,
            id: 'new-recipient-1',
            createdAt: new Date('2026-08-19T10:00:00Z'),
            repliedAt: null,
            replySubject: null,
            campaign: {} as EmailCampaignRecipientEntity['campaign'],
          };

          return Promise.resolve({
            campaign: {
              ...campaign,
              audienceCount: campaign.audienceCount + 1,
            },
            recipient: savedRecipient,
          });
        }),
    };

    const recipientsRepository = {
      findByCampaignIdAndEmail: jest
        .fn<Promise<EmailCampaignRecipientEntity | null>, [string, string]>()
        .mockResolvedValue(options?.existingRecipient ?? null),
    };

    const messagesRepository = {
      findByCampaignIdAndRecipientIds: jest
        .fn<Promise<[]>, [string, string[]]>()
        .mockResolvedValue([]),
    };

    const excludedRepository = {
      findByOrganizationIdAndEmail: jest
        .fn<Promise<{ email: string } | null>, [string, string]>()
        .mockResolvedValue(
          options?.excludedEmail ? { email: 'blocked@example.com' } : null,
        ),
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
            status: 'pending',
            latestDeliveryStatus: 'pending',
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
      excludedRepository as never,
      campaignRecipientMapper as never,
    );

    return {
      service,
      emailCampaignsRepository,
      recipientsRepository,
    };
  }

  it('adds a recipient starting at step 1 for a sending campaign', async () => {
    const { service, emailCampaignsRepository } = createService();

    const response = await service.addRecipient(campaignId, organizationId, {
      email: 'Jane@Example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      company: 'Acme',
    });

    expect(emailCampaignsRepository.addCampaignRecipient).toHaveBeenCalledWith(
      sendingCampaign,
      expect.objectContaining({
        email: 'jane@example.com',
        currentStepOrder: 1,
        status: 'pending',
        contactDisposition: 'eligible',
        nextSendAt: null,
        mergeFields: {
          email: 'jane@example.com',
          first_name: 'Jane',
          last_name: 'Doe',
          full_name: 'Jane Doe',
          company: 'Acme',
        },
      }),
    );
    expect(response.currentStepOrder).toBe(1);
    expect(response.email).toBe('jane@example.com');
  });

  it('allows adding to a scheduled campaign', async () => {
    const { service } = createService({
      campaign: { ...sendingCampaign, status: 'scheduled' },
    });

    const response = await service.addRecipient(campaignId, organizationId, {
      email: 'new@example.com',
    });

    expect(response.currentStepOrder).toBe(1);
  });

  it('rejects adding to a draft campaign', async () => {
    const { service } = createService({
      campaign: { ...sendingCampaign, status: 'draft' },
    });

    await expect(
      service.addRecipient(campaignId, organizationId, {
        email: 'new@example.com',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate email in the same campaign', async () => {
    const { service } = createService({
      existingRecipient: {
        id: 'existing-1',
        campaignId,
        email: 'jane@example.com',
      } as EmailCampaignRecipientEntity,
    });

    await expect(
      service.addRecipient(campaignId, organizationId, {
        email: 'jane@example.com',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects email on the organization exclusion list', async () => {
    const { service } = createService({ excludedEmail: true });

    await expect(
      service.addRecipient(campaignId, organizationId, {
        email: 'blocked@example.com',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
