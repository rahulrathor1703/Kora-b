import { NotFoundException } from '@nestjs/common';
import { CampaignTrackingService } from './campaign-tracking.service';
import { signClickLink } from './campaign-tracking-signature.util';
import type { EmailCampaignMessageEntity } from './entities/email-campaign-message.entity';

describe('CampaignTrackingService', () => {
  const trackingToken = '00000000-0000-0000-0000-000000000099';
  const hmacSecret = 'test-tracking-secret';

  let findByTrackingToken: jest.Mock;
  let recordOpen: jest.Mock;
  let recordClick: jest.Mock;
  let service: CampaignTrackingService;

  function buildMessage(
    overrides: Partial<EmailCampaignMessageEntity> = {},
  ): EmailCampaignMessageEntity {
    return {
      id: 'message-1',
      campaignId: 'campaign-1',
      recipientId: 'recipient-1',
      stepOrder: 1,
      trackingToken,
      deliveryStatus: 'sent',
      openCount: 0,
      clickCount: 0,
      trackedLinks: [
        {
          index: 0,
          url: 'https://example.com/page',
          label: 'Book a demo',
        },
      ],
      ...overrides,
    } as EmailCampaignMessageEntity;
  }

  beforeEach(() => {
    findByTrackingToken = jest.fn();
    recordOpen = jest.fn().mockResolvedValue(undefined);
    recordClick = jest.fn().mockResolvedValue(undefined);

    service = new CampaignTrackingService(
      {
        findByTrackingToken,
      } as never,
      {
        recordOpen,
        recordClick,
        recordUnsubscribe: jest.fn(),
      } as never,
      {
        get: jest.fn().mockReturnValue(hmacSecret),
      } as never,
    );
  });

  it('records open for sent messages', async () => {
    const message = buildMessage();
    findByTrackingToken.mockResolvedValue(message);

    await service.recordOpen(trackingToken, {
      userAgent: 'Mozilla/5.0',
      ipAddress: '127.0.0.1',
    });

    expect(recordOpen).toHaveBeenCalledWith(
      message,
      expect.any(Date),
      expect.objectContaining({
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
      }),
    );
  });

  it('rejects open tracking for pending messages', async () => {
    findByTrackingToken.mockResolvedValue(
      buildMessage({ deliveryStatus: 'pending' }),
    );

    await expect(service.recordOpen(trackingToken)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(recordOpen).not.toHaveBeenCalled();
  });

  it('records registry click and returns redirect URL for sent messages', async () => {
    const message = buildMessage();
    findByTrackingToken.mockResolvedValue(message);
    const signature = signClickLink(hmacSecret, trackingToken, 0);

    const redirectUrl = await service.resolveClickRedirect(trackingToken, {
      linkIndex: 0,
      sig: signature,
      userAgent: 'Mozilla/5.0',
      ipAddress: '127.0.0.1',
    });

    expect(redirectUrl).toBe('https://example.com/page');
    expect(recordClick).toHaveBeenCalledWith(message, {
      url: 'https://example.com/page',
      linkIndex: 0,
      linkLabel: 'Book a demo',
      userAgent: 'Mozilla/5.0',
      ipAddress: '127.0.0.1',
    });
  });

  it('rejects invalid click signatures', async () => {
    findByTrackingToken.mockResolvedValue(buildMessage());

    await expect(
      service.resolveClickRedirect(trackingToken, {
        linkIndex: 0,
        sig: 'invalid-signature',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(recordClick).not.toHaveBeenCalled();
  });

  it('rejects click redirects without a signed link index', async () => {
    findByTrackingToken.mockResolvedValue(buildMessage());

    await expect(
      service.resolveClickRedirect(trackingToken, {
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(recordClick).not.toHaveBeenCalled();
  });
});
