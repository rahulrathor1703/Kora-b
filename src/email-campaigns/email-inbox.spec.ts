import { CampaignEventService } from './campaign-event.service';
import type { EmailCampaignRecipientEntity } from './entities/email-campaign-recipient.entity';
import type { EmailCampaignMessageEntity } from './entities/email-campaign-message.entity';
import {
  EmailInboxMapper,
  resolveRecipientName,
} from './mappers/email-inbox.mapper';
import { applyInboxReplyListOrdering } from './inbox-reply-query.util';

describe('applyInboxReplyListOrdering', () => {
  it('uses TypeORM-safe order clauses instead of COALESCE expressions', () => {
    const orderBy = jest.fn().mockReturnThis();
    const addOrderBy = jest.fn().mockReturnThis();
    const qb = { orderBy, addOrderBy } as never;

    applyInboxReplyListOrdering(qb);

    expect(orderBy).toHaveBeenCalledWith(
      'recipient.replyReadAt',
      'ASC',
      'NULLS FIRST',
    );
    expect(addOrderBy).toHaveBeenCalledWith(
      'recipient.repliedAt',
      'DESC',
      'NULLS LAST',
    );
    expect(addOrderBy).toHaveBeenCalledWith('recipient.createdAt', 'DESC');
    expect(orderBy).not.toHaveBeenCalledWith(
      expect.stringContaining('COALESCE'),
      expect.anything(),
    );
  });
});

describe('resolveRecipientName', () => {
  it('returns full_name when present', () => {
    expect(
      resolveRecipientName({
        full_name: 'Jane Doe',
        first_name: 'Jane',
      }),
    ).toBe('Jane Doe');
  });

  it('builds name from first and last name fields', () => {
    expect(
      resolveRecipientName({
        first_name: 'Jane',
        last_name: 'Doe',
      }),
    ).toBe('Jane Doe');
  });

  it('returns null when no name fields are available', () => {
    expect(resolveRecipientName({ email: 'jane@example.com' })).toBeNull();
  });
});

describe('EmailInboxMapper', () => {
  const mapper = new EmailInboxMapper();

  function buildRecipient(
    overrides: Partial<EmailCampaignRecipientEntity> = {},
  ): EmailCampaignRecipientEntity {
    return {
      id: 'recipient-1',
      campaignId: 'campaign-1',
      email: 'jane@example.com',
      mergeFields: { first_name: 'Jane', last_name: 'Doe' },
      currentStepOrder: 2,
      status: 'active',
      nextSendAt: null,
      lastSentAt: new Date('2026-08-14T10:00:00Z'),
      replyCategory: 'interested',
      repliedAt: new Date('2026-08-14T11:00:00Z'),
      replySubject: 'Re: Partnership opportunity',
      contactDisposition: 'paused',
      createdAt: new Date('2026-08-14T09:00:00Z'),
      campaign: {} as never,
      ...overrides,
    };
  }

  it('maps recipient reply metadata for inbox listing', () => {
    const response = mapper.toResponse({
      recipient: buildRecipient(),
      campaignName: 'Q3 Outreach',
    });

    expect(response).toEqual({
      recipientId: 'recipient-1',
      campaignId: 'campaign-1',
      campaignName: 'Q3 Outreach',
      recipientEmail: 'jane@example.com',
      recipientName: 'Jane Doe',
      replySubject: 'Re: Partnership opportunity',
      repliedAt: '2026-08-14T11:00:00.000Z',
      replyCategory: 'interested',
      replyReadAt: null,
      replyDoneReason: null,
      currentStepOrder: 2,
      contactDisposition: 'paused',
    });
  });

  it('maps done reply metadata including reason', () => {
    const response = mapper.toResponse({
      recipient: buildRecipient({
        replyReadAt: new Date('2026-08-14T12:00:00Z'),
        replyDoneReason: 'Scheduled follow-up call',
      }),
      campaignName: 'Q3 Outreach',
    });

    expect(response.replyReadAt).toBe('2026-08-14T12:00:00.000Z');
    expect(response.replyDoneReason).toBe('Scheduled follow-up call');
  });
});

describe('CampaignEventService.recordReply', () => {
  function buildRecipient(): EmailCampaignRecipientEntity {
    return {
      id: 'recipient-1',
      campaignId: 'campaign-1',
      email: 'jane@example.com',
      mergeFields: {},
      currentStepOrder: 1,
      status: 'active',
      nextSendAt: new Date('2026-08-15T10:00:00Z'),
      lastSentAt: new Date('2026-08-14T10:00:00Z'),
      replyCategory: null,
      repliedAt: null,
      replySubject: null,
      contactDisposition: 'eligible',
      createdAt: new Date('2026-08-14T09:00:00Z'),
      campaign: {} as never,
    };
  }

  function buildMessage(): EmailCampaignMessageEntity {
    return {
      id: 'message-1',
      campaignId: 'campaign-1',
      recipientId: 'recipient-1',
      stepOrder: 1,
      trackingToken: '00000000-0000-0000-0000-000000000001',
      providerMessageId: '<provider-id@mail.gmail.com>',
      deliveryStatus: 'sent',
      sentAt: new Date('2026-08-14T10:00:00Z'),
      bouncedAt: null,
      bounceReason: null,
      openedAt: null,
      openCount: 0,
      clickedAt: null,
      clickCount: 0,
      createdAt: new Date('2026-08-14T10:00:00Z'),
      recipient: {} as never,
      campaign: {} as never,
    };
  }

  it('persists reply subject and pauses the recipient', async () => {
    const recipient = buildRecipient();
    const save = jest.fn((entity: EmailCampaignRecipientEntity) =>
      Promise.resolve(entity),
    );
    const insert = jest.fn(() => Promise.resolve(undefined));

    const service = new CampaignEventService(
      { insert } as never,
      {} as never,
      { save } as never,
      {} as never,
      {} as never,
    );

    await service.recordReply(
      recipient,
      buildMessage(),
      new Date('2026-08-14T11:00:00Z'),
      {
        subject: 'Re: Quick question',
      },
    );

    expect(recipient.repliedAt?.toISOString()).toBe('2026-08-14T11:00:00.000Z');
    expect(recipient.replySubject).toBe('Re: Quick question');
    expect(recipient.contactDisposition).toBe('paused');
    expect(recipient.nextSendAt).toBeNull();
    expect(save).toHaveBeenCalledWith(recipient);

    const insertArg = insert.mock.calls[0]?.[0] as {
      eventType: string;
      metadata: { subject: string | null };
    };

    expect(insertArg.eventType).toBe('reply');
    expect(insertArg.metadata.subject).toBe('Re: Quick question');
  });
});
