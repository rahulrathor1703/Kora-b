import { ForbiddenException } from '@nestjs/common';
import { ListCampaignMemberSyncService } from './list-campaign-member-sync.service';

describe('ListCampaignMemberSyncService', () => {
  const organizationId = 'org-1';
  const listId = 'list-1';
  const context = {
    listType: 'contact' as const,
    listId,
    organizationId,
  };

  const scheduledCampaign = {
    id: 'campaign-1',
    organizationId,
    name: 'Outreach',
    audienceListType: 'contact' as const,
    audienceListId: listId,
    status: 'scheduled' as const,
  };

  const draftCampaign = {
    id: 'campaign-2',
    organizationId,
    name: 'Draft campaign',
    audienceListType: 'contact' as const,
    audienceListId: listId,
    status: 'draft' as const,
  };

  function createService(options?: {
    linkedCampaigns?: Array<typeof scheduledCampaign | typeof draftCampaign>;
    recipient?: {
      id: string;
      contactDisposition: 'eligible' | 'stopped' | 'excluded';
    } | null;
    existingRecipient?: boolean;
  }) {
    const emailCampaignsRepository = {
      findByAudienceList: jest
        .fn()
        .mockResolvedValue(options?.linkedCampaigns ?? [scheduledCampaign]),
      findByIdAndOrganizationId: jest.fn().mockResolvedValue(scheduledCampaign),
    };

    const recipientsRepository = {
      findByCampaignIdAndEmail: jest.fn().mockResolvedValue(
        options?.recipient === undefined
          ? {
              id: 'recipient-1',
              contactDisposition: 'eligible',
            }
          : options.recipient,
      ),
    };

    const recipientsService = {
      stopRecipient: jest.fn().mockResolvedValue({}),
      excludeRecipientGlobally: jest.fn().mockResolvedValue({}),
      addRecipient: jest.fn().mockResolvedValue({}),
    };

    const audienceResolver = {
      resolveContactListMembers: jest.fn().mockReturnValue([
        {
          email: 'user@example.com',
          mergeFields: {
            email: 'user@example.com',
            first_name: 'User',
            last_name: 'Example',
            company: 'Acme',
          },
        },
      ]),
      resolveManualListRows: jest.fn().mockReturnValue([
        {
          email: 'user@example.com',
          mergeFields: { email: 'user@example.com' },
        },
      ]),
    };

    const excludedRepository = {
      findByOrganizationIdAndEmail: jest.fn().mockResolvedValue(null),
    };

    const service = new ListCampaignMemberSyncService(
      emailCampaignsRepository as never,
      recipientsRepository as never,
      recipientsService as never,
      audienceResolver as never,
      excludedRepository as never,
    );

    return {
      service,
      emailCampaignsRepository,
      recipientsRepository,
      recipientsService,
    };
  }

  describe('getRemovalPreview', () => {
    it('returns actionable campaign impacts for enrolled recipients', async () => {
      const { service } = createService();

      const impacts = await service.getRemovalPreview(
        context,
        'user@example.com',
      );

      expect(impacts).toEqual([
        {
          campaignId: 'campaign-1',
          campaignName: 'Outreach',
          status: 'scheduled',
          recipientId: 'recipient-1',
          contactDisposition: 'eligible',
        },
      ]);
    });

    it('skips campaigns without an actionable recipient', async () => {
      const { service } = createService({
        recipient: {
          id: 'recipient-1',
          contactDisposition: 'stopped',
        },
      });

      const impacts = await service.getRemovalPreview(
        context,
        'user@example.com',
      );

      expect(impacts).toEqual([]);
    });
  });

  describe('getEnrollmentOptions', () => {
    it('marks draft campaigns as requiresSchedule', async () => {
      const { service } = createService({
        linkedCampaigns: [scheduledCampaign, draftCampaign],
        recipient: null,
      });

      const options = await service.getEnrollmentOptions(context, [
        'user@example.com',
      ]);

      expect(options).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            campaignId: 'campaign-2',
            requiresSchedule: true,
            canEnroll: false,
          }),
          expect.objectContaining({
            campaignId: 'campaign-1',
            canEnroll: true,
          }),
        ]),
      );
    });
  });

  describe('removeFromCampaigns', () => {
    it('requires email-campaigns:update permission', async () => {
      const { service } = createService();

      await expect(
        service.removeFromCampaigns(
          organizationId,
          'user@example.com',
          [{ campaignId: 'campaign-1', action: 'stop' }],
          { role: 'member', permissions: ['contact-lists:update'] },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('stops recipients in selected campaigns', async () => {
      const { service, recipientsService } = createService();

      const results = await service.removeFromCampaigns(
        organizationId,
        'user@example.com',
        [{ campaignId: 'campaign-1', action: 'stop' }],
        {
          role: 'admin',
          permissions: ['email-campaigns:update'],
        },
      );

      expect(recipientsService.stopRecipient).toHaveBeenCalledWith(
        'campaign-1',
        'recipient-1',
        organizationId,
      );
      expect(results).toEqual([{ campaignId: 'campaign-1', success: true }]);
    });

    it('excludes recipients globally from all campaigns', async () => {
      const { service, recipientsService } = createService();

      const results = await service.removeFromCampaigns(
        organizationId,
        'user@example.com',
        [{ campaignId: 'campaign-1', action: 'exclude_globally' }],
        {
          role: 'admin',
          permissions: ['email-campaigns:update'],
        },
      );

      expect(recipientsService.excludeRecipientGlobally).toHaveBeenCalledWith(
        'campaign-1',
        'recipient-1',
        organizationId,
      );
      expect(recipientsService.stopRecipient).not.toHaveBeenCalled();
      expect(results).toEqual([{ campaignId: 'campaign-1', success: true }]);
    });
  });

  describe('enrollMembers', () => {
    it('adds recipients to eligible campaigns', async () => {
      const { service, recipientsService } = createService({
        recipient: null,
      });

      const results = await service.enrollMembers(
        context,
        [
          {
            email: 'user@example.com',
            mergeFields: {
              email: 'user@example.com',
              first_name: 'User',
              last_name: 'Example',
              company: 'Acme',
            },
          },
        ],
        ['campaign-1'],
        {
          role: 'admin',
          permissions: ['email-campaigns:update'],
        },
      );

      expect(recipientsService.addRecipient).toHaveBeenCalled();
      expect(results).toEqual([
        {
          campaignId: 'campaign-1',
          email: 'user@example.com',
          success: true,
        },
      ]);
    });
  });
});
