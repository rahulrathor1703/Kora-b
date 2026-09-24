import { CampaignListMetricsMapper } from './mappers/campaign-list-metrics.mapper';

describe('CampaignListMetricsMapper', () => {
  const mapper = new CampaignListMetricsMapper();
  const now = new Date('2026-09-10T12:00:00.000Z');

  it('computes engagement metrics and sending pace from aggregate rows', () => {
    const response = mapper.toResponse(
      {
        campaignId: 'campaign-1',
        launchAt: new Date('2026-09-08T12:00:00.000Z'),
        sent: '3',
        opened: '1',
        clicked: '0',
        bounced: '0',
        replied: '0',
        unsubscribed: '0',
      },
      now,
    );

    expect(response).toEqual({
      campaignId: 'campaign-1',
      totalSent: 3,
      deliverability: 100,
      openRate: 33,
      ctr: 0,
      replyRate: 0,
      bounceRate: 0,
      unsubscribeRate: 0,
      sendingPace: 2,
    });
  });

  it('returns null sending pace when the campaign has not launched', () => {
    const response = mapper.toResponse(
      {
        campaignId: 'campaign-2',
        launchAt: null,
        sent: '0',
        opened: '0',
        clicked: '0',
        bounced: '0',
        replied: '0',
        unsubscribed: '0',
      },
      now,
    );

    expect(response.sendingPace).toBeNull();
  });
});
