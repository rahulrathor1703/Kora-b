import { EmailCampaignRecipientEntity } from './entities/email-campaign-recipient.entity';
import { EmailCampaignRecipientsRepository } from './email-campaign-recipients.repository';

describe('EmailCampaignRecipientsRepository recipient actions', () => {
  function createRepository() {
    const entities: EmailCampaignRecipientEntity[] = [];

    const repository = {
      createQueryBuilder: jest.fn(),
      save: jest
        .fn()
        .mockImplementation((items: EmailCampaignRecipientEntity[]) => {
          for (const item of items) {
            const index = entities.findIndex((entry) => entry.id === item.id);

            if (index >= 0) {
              entities[index] = item;
            } else {
              entities.push(item);
            }
          }

          return Promise.resolve(items);
        }),
    };

    const repo = new EmailCampaignRecipientsRepository(repository as never);
    return { repo, repository, entities };
  }

  it('resumeExpiredPauses flips eligible and sets allowSendDespiteReply when replied', async () => {
    const expiredRecipient = {
      id: 'recipient-1',
      contactDisposition: 'paused',
      pausedUntil: new Date('2026-08-18T00:00:00Z'),
      repliedAt: new Date('2026-08-17T10:00:00Z'),
      allowSendDespiteReply: false,
    } as EmailCampaignRecipientEntity;

    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([expiredRecipient]),
    };

    const { repo, repository } = createRepository();
    repository.createQueryBuilder.mockReturnValue(queryBuilder);

    const resumed = await repo.resumeExpiredPauses(
      new Date('2026-08-19T00:00:00Z'),
    );

    expect(resumed).toBe(1);
    expect(expiredRecipient.contactDisposition).toBe('eligible');
    expect(expiredRecipient.pausedUntil).toBeNull();
    expect(expiredRecipient.allowSendDespiteReply).toBe(true);
    expect(repository.save).toHaveBeenCalledWith([expiredRecipient]);
  });
});
