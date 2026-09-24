import type { EmailCampaignStatus } from '../email-campaigns/entities/email-campaign.entity';
import type { EmailCampaignContactDisposition } from '../email-campaigns/entities/email-campaign-recipient.entity';
import type { AudienceListType } from '../email-campaigns/entities/email-campaign.entity';

export type ListCampaignRemovalAction = 'stop' | 'exclude_globally';

export interface ListCampaignRemovalImpact {
  campaignId: string;
  campaignName: string;
  status: EmailCampaignStatus;
  recipientId: string;
  contactDisposition: EmailCampaignContactDisposition;
}

export interface ListCampaignEnrollmentOption {
  campaignId: string;
  campaignName: string;
  status: EmailCampaignStatus;
  requiresSchedule: boolean;
  canEnroll: boolean;
  alreadyEnrolled: boolean;
  reason?: string;
}

export interface ListCampaignRemovalActionInput {
  campaignId: string;
  action: ListCampaignRemovalAction;
}

export interface ListCampaignRemovalResult {
  campaignId: string;
  success: boolean;
  error?: string;
}

export interface ListMemberEnrollmentInput {
  email: string;
  mergeFields: Record<string, string>;
}

export interface ListCampaignEnrollResult {
  campaignId: string;
  email: string;
  success: boolean;
  error?: string;
}

export interface ListCampaignSyncContext {
  listType: AudienceListType;
  listId: string;
  organizationId: string;
}
