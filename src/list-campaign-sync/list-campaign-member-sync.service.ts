import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { hasPermission } from '../auth/auth-access.utils';
import { CampaignAudienceResolverService } from '../email-campaigns/campaign-audience-resolver.service';
import {
  assertRecipientActionAllowed,
  isBlockedDisposition,
} from '../email-campaigns/campaign-recipient-action.util';
import { EmailCampaignRecipientsService } from '../email-campaigns/campaign-progress.service';
import { EmailCampaignRecipientsRepository } from '../email-campaigns/email-campaign-recipients.repository';
import { EmailCampaignsRepository } from '../email-campaigns/email-campaigns.repository';
import type { EmailCampaignStatus } from '../email-campaigns/entities/email-campaign.entity';
import { EmailExcludedRepository } from '../email-campaigns/email-excluded.repository';
import type {
  ListCampaignEnrollResult,
  ListCampaignEnrollmentOption,
  ListCampaignRemovalActionInput,
  ListCampaignRemovalImpact,
  ListCampaignRemovalResult,
  ListCampaignSyncContext,
  ListMemberEnrollmentInput,
} from './list-campaign-sync.types';

const REMOVAL_CAMPAIGN_STATUSES: EmailCampaignStatus[] = [
  'scheduled',
  'sending',
  'paused',
];

const ENROLLMENT_OPTION_STATUSES: EmailCampaignStatus[] = [
  'draft',
  'scheduled',
  'sending',
  'paused',
];

const ENROLLABLE_CAMPAIGN_STATUSES: EmailCampaignStatus[] = [
  'scheduled',
  'sending',
];

@Injectable()
export class ListCampaignMemberSyncService {
  constructor(
    private readonly emailCampaignsRepository: EmailCampaignsRepository,
    private readonly recipientsRepository: EmailCampaignRecipientsRepository,
    private readonly recipientsService: EmailCampaignRecipientsService,
    private readonly audienceResolver: CampaignAudienceResolverService,
    private readonly excludedRepository: EmailExcludedRepository,
  ) {}

  async getRemovalPreview(
    context: ListCampaignSyncContext,
    email: string,
  ): Promise<ListCampaignRemovalImpact[]> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return [];
    }

    const linkedCampaigns =
      await this.emailCampaignsRepository.findByAudienceList(
        context.organizationId,
        context.listType,
        context.listId,
      );

    const activeCampaigns = linkedCampaigns.filter((campaign) =>
      REMOVAL_CAMPAIGN_STATUSES.includes(campaign.status),
    );

    if (activeCampaigns.length === 0) {
      return [];
    }

    const impacts: ListCampaignRemovalImpact[] = [];

    for (const campaign of activeCampaigns) {
      const recipient =
        await this.recipientsRepository.findByCampaignIdAndEmail(
          campaign.id,
          normalizedEmail,
        );

      if (
        !recipient ||
        !this.isRecipientActionableForRemoval(recipient.contactDisposition)
      ) {
        continue;
      }

      impacts.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        status: campaign.status,
        recipientId: recipient.id,
        contactDisposition: recipient.contactDisposition,
      });
    }

    return impacts;
  }

  async removeFromCampaigns(
    organizationId: string,
    email: string,
    actions: ListCampaignRemovalActionInput[],
    user: Pick<AuthUser, 'role' | 'permissions'>,
  ): Promise<ListCampaignRemovalResult[]> {
    if (actions.length === 0) {
      return [];
    }

    this.assertCanUpdateCampaigns(user);

    const normalizedEmail = email.trim().toLowerCase();
    const globalExcludeAction = actions.find(
      (action) => action.action === 'exclude_globally',
    );

    if (globalExcludeAction) {
      return this.excludeGloballyFromCampaigns(
        organizationId,
        normalizedEmail,
        globalExcludeAction.campaignId,
      );
    }

    const results: ListCampaignRemovalResult[] = [];

    for (const action of actions) {
      try {
        const campaign =
          await this.emailCampaignsRepository.findByIdAndOrganizationId(
            action.campaignId,
            organizationId,
          );

        if (!campaign) {
          results.push({
            campaignId: action.campaignId,
            success: false,
            error: 'Campaign not found',
          });
          continue;
        }

        const recipient =
          await this.recipientsRepository.findByCampaignIdAndEmail(
            action.campaignId,
            normalizedEmail,
          );

        if (!recipient) {
          results.push({
            campaignId: action.campaignId,
            success: false,
            error: 'Recipient not found in campaign',
          });
          continue;
        }

        await this.recipientsService.stopRecipient(
          action.campaignId,
          recipient.id,
          organizationId,
        );

        results.push({ campaignId: action.campaignId, success: true });
      } catch (error) {
        results.push({
          campaignId: action.campaignId,
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Unable to update campaign',
        });
      }
    }

    return results;
  }

  private async excludeGloballyFromCampaigns(
    organizationId: string,
    normalizedEmail: string,
    campaignId: string,
  ): Promise<ListCampaignRemovalResult[]> {
    try {
      const campaign =
        await this.emailCampaignsRepository.findByIdAndOrganizationId(
          campaignId,
          organizationId,
        );

      if (!campaign) {
        return [
          {
            campaignId,
            success: false,
            error: 'Campaign not found',
          },
        ];
      }

      const recipient =
        await this.recipientsRepository.findByCampaignIdAndEmail(
          campaignId,
          normalizedEmail,
        );

      if (!recipient) {
        return [
          {
            campaignId,
            success: false,
            error: 'Recipient not found in campaign',
          },
        ];
      }

      await this.recipientsService.excludeRecipientGlobally(
        campaignId,
        recipient.id,
        organizationId,
      );

      return [{ campaignId, success: true }];
    } catch (error) {
      return [
        {
          campaignId,
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Unable to exclude globally',
        },
      ];
    }
  }

  async getEnrollmentOptions(
    context: ListCampaignSyncContext,
    emails: string[],
  ): Promise<ListCampaignEnrollmentOption[]> {
    const normalizedEmails = [
      ...new Set(
        emails.map((email) => email.trim().toLowerCase()).filter(Boolean),
      ),
    ];

    const linkedCampaigns =
      await this.emailCampaignsRepository.findByAudienceList(
        context.organizationId,
        context.listType,
        context.listId,
      );

    const relevantCampaigns = linkedCampaigns.filter((campaign) =>
      ENROLLMENT_OPTION_STATUSES.includes(campaign.status),
    );

    const options: ListCampaignEnrollmentOption[] = [];

    for (const campaign of relevantCampaigns) {
      const requiresSchedule = campaign.status === 'draft';
      const canEnrollBase = ENROLLABLE_CAMPAIGN_STATUSES.includes(
        campaign.status,
      );

      let alreadyEnrolled = false;
      if (normalizedEmails.length === 1) {
        const existing =
          await this.recipientsRepository.findByCampaignIdAndEmail(
            campaign.id,
            normalizedEmails[0] ?? '',
          );
        alreadyEnrolled = Boolean(existing);
      }

      let canEnroll = canEnrollBase && !alreadyEnrolled;
      let reason: string | undefined;

      if (requiresSchedule) {
        canEnroll = false;
        reason = 'Included automatically when the campaign is scheduled';
      } else if (campaign.status === 'paused') {
        canEnroll = false;
        reason = 'Resume the campaign to add recipients';
      } else if (alreadyEnrolled) {
        canEnroll = false;
        reason = 'Already in this campaign';
      }

      options.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        status: campaign.status,
        requiresSchedule,
        canEnroll,
        alreadyEnrolled,
        reason,
      });
    }

    return options;
  }

  async enrollMembers(
    context: ListCampaignSyncContext,
    inputs: ListMemberEnrollmentInput[],
    campaignIds: string[],
    user: Pick<AuthUser, 'role' | 'permissions'>,
  ): Promise<ListCampaignEnrollResult[]> {
    if (campaignIds.length === 0 || inputs.length === 0) {
      return [];
    }

    this.assertCanUpdateCampaigns(user);

    const results: ListCampaignEnrollResult[] = [];
    const uniqueCampaignIds = [...new Set(campaignIds)];

    for (const campaignId of uniqueCampaignIds) {
      const campaign =
        await this.emailCampaignsRepository.findByIdAndOrganizationId(
          campaignId,
          context.organizationId,
        );

      if (!campaign) {
        for (const input of inputs) {
          results.push({
            campaignId,
            email: input.email,
            success: false,
            error: 'Campaign not found',
          });
        }
        continue;
      }

      if (
        campaign.audienceListType !== context.listType ||
        campaign.audienceListId !== context.listId
      ) {
        for (const input of inputs) {
          results.push({
            campaignId,
            email: input.email,
            success: false,
            error: 'Campaign does not use this list as its audience',
          });
        }
        continue;
      }

      if (!ENROLLABLE_CAMPAIGN_STATUSES.includes(campaign.status)) {
        for (const input of inputs) {
          results.push({
            campaignId,
            email: input.email,
            success: false,
            error: 'Campaign is not accepting new recipients',
          });
        }
        continue;
      }

      for (const input of inputs) {
        const normalizedEmail = input.email.trim().toLowerCase();

        try {
          const existing =
            await this.recipientsRepository.findByCampaignIdAndEmail(
              campaign.id,
              normalizedEmail,
            );

          if (existing) {
            results.push({
              campaignId,
              email: normalizedEmail,
              success: false,
              error: 'Already in this campaign',
            });
            continue;
          }

          const excluded =
            await this.excludedRepository.findByOrganizationIdAndEmail(
              context.organizationId,
              normalizedEmail,
            );

          if (excluded) {
            results.push({
              campaignId,
              email: normalizedEmail,
              success: false,
              error: 'On organization exclusion list',
            });
            continue;
          }

          const firstName = input.mergeFields.first_name?.trim() ?? '';
          const lastName = input.mergeFields.last_name?.trim() ?? '';
          const company = input.mergeFields.company?.trim() ?? '';

          await this.recipientsService.addRecipient(
            campaign.id,
            context.organizationId,
            {
              email: normalizedEmail,
              firstName,
              lastName,
              company,
            },
          );

          results.push({
            campaignId,
            email: normalizedEmail,
            success: true,
          });
        } catch (error) {
          results.push({
            campaignId,
            email: normalizedEmail,
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Unable to add to campaign',
          });
        }
      }
    }

    return results;
  }

  resolveContactMemberMergeFields(member: {
    email: string;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    phone: string | null;
    customFields: Record<string, string>;
  }): ListMemberEnrollmentInput {
    const [resolved] = this.audienceResolver.resolveContactListMembers([
      member,
    ]);

    if (!resolved) {
      throw new BadRequestException('Unable to resolve contact merge fields');
    }

    return resolved;
  }

  resolveManualRowMergeFields(
    columns: Array<{ key: string; label: string }>,
    row: { data: Record<string, string> },
  ): ListMemberEnrollmentInput {
    const [resolved] = this.audienceResolver.resolveManualListRows(columns, [
      row,
    ]);

    if (!resolved) {
      throw new BadRequestException(
        'Unable to resolve row merge fields — email column is required',
      );
    }

    return resolved;
  }

  assertCanUpdateCampaigns(user: Pick<AuthUser, 'role' | 'permissions'>): void {
    if (!hasPermission(user, 'email-campaigns:update')) {
      throw new ForbiddenException(
        'You do not have permission to update campaigns',
      );
    }
  }

  canUpdateCampaigns(user: Pick<AuthUser, 'role' | 'permissions'>): boolean {
    return hasPermission(user, 'email-campaigns:update');
  }

  private isRecipientActionableForRemoval(contactDisposition: string): boolean {
    if (isBlockedDisposition(contactDisposition as never)) {
      return false;
    }

    if (contactDisposition === 'excluded' || contactDisposition === 'stopped') {
      return false;
    }

    try {
      assertRecipientActionAllowed(contactDisposition as never);
      return true;
    } catch {
      return false;
    }
  }
}
