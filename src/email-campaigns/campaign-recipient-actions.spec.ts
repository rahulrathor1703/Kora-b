import { BadRequestException } from '@nestjs/common';
import { EmailCampaignRecipientsService } from './campaign-progress.service';
import type { EmailCampaignRecipientEntity } from './entities/email-campaign-recipient.entity';
import type { CampaignRecipientResponse } from './mappers/campaign-recipient.mapper';

describe('EmailCampaignRecipientsService recipient actions', () => {
  const campaignId = 'campaign-1';
  const organizationId = 'org-1';

  const campaign = {
    id: campaignId,
    organizationId,
    name: 'Q3 Outreach',
    audienceListId: 'list-1',
    audienceListType: 'contact',
    status: 'sending',
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
      pausedUntil: null,
      allowSendDespiteReply: false,
      createdAt: new Date('2026-08-15T10:00:00Z'),
      campaign: {} as EmailCampaignRecipientEntity['campaign'],
      ...overrides,
    };
  }

  function createService(
    recipient: EmailCampaignRecipientEntity,
    options: {
      globallyExcluded?: boolean;
    } = {},
  ) {
    const savedRecipient = { ...recipient };
    let storedRecipient = { ...recipient };

    const emailCampaignsRepository = {
      findByIdAndOrganizationId: jest
        .fn<Promise<typeof campaign | null>, [string, string]>()
        .mockResolvedValue(campaign),
    };

    const recipientsRepository = {
      findByIdAndCampaignId: jest
        .fn<Promise<EmailCampaignRecipientEntity | null>, [string, string]>()
        .mockImplementation(() => Promise.resolve({ ...storedRecipient })),
      save: jest
        .fn<
          Promise<EmailCampaignRecipientEntity>,
          [EmailCampaignRecipientEntity]
        >()
        .mockImplementation((entity) => {
          Object.assign(savedRecipient, entity);
          storedRecipient = { ...savedRecipient };
          return Promise.resolve(savedRecipient);
        }),
      stopActiveRecipientsByEmailInOrganization: jest
        .fn<Promise<void>, [string, string]>()
        .mockResolvedValue(undefined),
    };

    const messagesRepository = {
      findByCampaignIdAndRecipientIds: jest
        .fn<Promise<[]>, [string, string[]]>()
        .mockResolvedValue([]),
    };

    const excludedRepository = {
      findByOrganizationIdAndEmail: jest
        .fn()
        .mockResolvedValue(options.globallyExcluded ? { id: 'ex-1' } : null),
      upsertExcludedAddress: jest.fn().mockResolvedValue({ id: 'ex-1' }),
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
          pausedUntil: entity.pausedUntil?.toISOString() ?? null,
          allowSendDespiteReply: entity.allowSendDespiteReply,
          globallyExcluded: options.globallyExcluded ?? false,
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
      excludedRepository as never,
      campaignRecipientMapper as never,
    );

    return {
      service,
      savedRecipient,
      excludedRepository,
      recipientsRepository,
    };
  }

  it('pauseRecipient sets paused disposition, pausedUntil, and clears nextSendAt', async () => {
    const recipient = buildRecipient();
    const { service, savedRecipient } = createService(recipient);
    const pausedUntil = new Date(Date.now() + 86_400_000).toISOString();

    await service.pauseRecipient(
      campaignId,
      recipient.id,
      organizationId,
      pausedUntil,
    );

    expect(savedRecipient.contactDisposition).toBe('paused');
    expect(savedRecipient.pausedUntil).toEqual(new Date(pausedUntil));
    expect(savedRecipient.nextSendAt).toBeNull();
    expect(savedRecipient.currentStepOrder).toBe(2);
  });

  it('rejects pause for already paused recipients', async () => {
    const recipient = buildRecipient({
      contactDisposition: 'paused',
      repliedAt: new Date('2026-08-16T12:00:00Z'),
      nextSendAt: null,
    });
    const { service } = createService(recipient);

    await expect(
      service.pauseRecipient(
        campaignId,
        recipient.id,
        organizationId,
        new Date(Date.now() + 86_400_000).toISOString(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows stop for paused recipients', async () => {
    const recipient = buildRecipient({
      contactDisposition: 'paused',
      pausedUntil: new Date(Date.now() + 86_400_000),
      nextSendAt: null,
    });
    const { service, savedRecipient } = createService(recipient);

    await service.stopRecipient(campaignId, recipient.id, organizationId);

    expect(savedRecipient.contactDisposition).toBe('stopped');
  });

  it('resumeRecipient resumes a manually paused recipient early', async () => {
    const pausedUntil = new Date(Date.now() + 86_400_000);
    const recipient = buildRecipient({
      contactDisposition: 'paused',
      pausedUntil,
      nextSendAt: null,
    });
    const { service, savedRecipient } = createService(recipient);

    await service.resumeRecipient(campaignId, recipient.id, organizationId);

    expect(savedRecipient.contactDisposition).toBe('eligible');
    expect(savedRecipient.pausedUntil).toBeNull();
  });

  it('resumeRecipient sets allowSendDespiteReply when recipient had replied', async () => {
    const recipient = buildRecipient({
      contactDisposition: 'paused',
      pausedUntil: new Date(Date.now() + 86_400_000),
      repliedAt: new Date('2026-08-16T12:00:00Z'),
      nextSendAt: null,
    });
    const { service, savedRecipient } = createService(recipient);

    await service.resumeRecipient(campaignId, recipient.id, organizationId);

    expect(savedRecipient.contactDisposition).toBe('eligible');
    expect(savedRecipient.allowSendDespiteReply).toBe(true);
    expect(savedRecipient.repliedAt).toEqual(new Date('2026-08-16T12:00:00Z'));
  });

  it('rejects resume for paused recipients without a resume date or reply', async () => {
    const recipient = buildRecipient({
      contactDisposition: 'paused',
      pausedUntil: null,
      repliedAt: null,
      nextSendAt: null,
    });
    const { service } = createService(recipient);

    await expect(
      service.resumeRecipient(campaignId, recipient.id, organizationId),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resumeRecipient continues a reply-paused recipient', async () => {
    const recipient = buildRecipient({
      contactDisposition: 'paused',
      pausedUntil: null,
      repliedAt: new Date('2026-08-16T12:00:00Z'),
      nextSendAt: null,
    });
    const { service, savedRecipient } = createService(recipient);

    await service.resumeRecipient(campaignId, recipient.id, organizationId);

    expect(savedRecipient.contactDisposition).toBe('eligible');
    expect(savedRecipient.allowSendDespiteReply).toBe(true);
  });

  it('rejects stop for stopped recipients', async () => {
    const recipient = buildRecipient({ contactDisposition: 'stopped' });
    const { service } = createService(recipient);

    await expect(
      service.stopRecipient(campaignId, recipient.id, organizationId),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows global exclude for stopped recipients', async () => {
    const recipient = buildRecipient({ contactDisposition: 'stopped' });
    const { service, excludedRepository } = createService(recipient);

    await service.excludeRecipientGlobally(
      campaignId,
      recipient.id,
      organizationId,
    );

    expect(excludedRepository.upsertExcludedAddress).toHaveBeenCalled();
  });

  it('rejects global exclude for campaign-excluded recipients', async () => {
    const recipient = buildRecipient({ contactDisposition: 'excluded' });
    const { service } = createService(recipient);

    await expect(
      service.excludeRecipientGlobally(
        campaignId,
        recipient.id,
        organizationId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects pause when pausedUntil is in the past', async () => {
    const recipient = buildRecipient();
    const { service } = createService(recipient);

    await expect(
      service.pauseRecipient(
        campaignId,
        recipient.id,
        organizationId,
        new Date(Date.now() - 86_400_000).toISOString(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects pause for done recipients', async () => {
    const recipient = buildRecipient({ contactDisposition: 'done' });
    const { service } = createService(recipient);

    await expect(
      service.pauseRecipient(
        campaignId,
        recipient.id,
        organizationId,
        new Date(Date.now() + 86_400_000).toISOString(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stopRecipient sets stopped disposition and clears scheduling fields', async () => {
    const recipient = buildRecipient();
    const { service, savedRecipient } = createService(recipient);

    await service.stopRecipient(campaignId, recipient.id, organizationId);

    expect(savedRecipient.contactDisposition).toBe('stopped');
    expect(savedRecipient.nextSendAt).toBeNull();
    expect(savedRecipient.pausedUntil).toBeNull();
  });

  it('excludeRecipientGlobally upserts org exclusion and stops active recipients', async () => {
    const recipient = buildRecipient();
    const { service, excludedRepository, recipientsRepository } =
      createService(recipient);

    await service.excludeRecipientGlobally(
      campaignId,
      recipient.id,
      organizationId,
    );

    expect(excludedRepository.upsertExcludedAddress).toHaveBeenCalledWith({
      organizationId,
      email: recipient.email,
      reason: 'Manually excluded from campaign',
      sourceCampaignId: campaignId,
    });
    expect(
      recipientsRepository.stopActiveRecipientsByEmailInOrganization,
    ).toHaveBeenCalledWith(organizationId, recipient.email);
  });
});
