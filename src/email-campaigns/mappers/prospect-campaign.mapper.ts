import type { CampaignRecipientResponse } from './campaign-recipient.mapper';

export interface ProspectCampaignItemResponse {
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  audienceListType: 'contact' | 'manual' | null;
  audienceListId: string | null;
  recipient: CampaignRecipientResponse;
}

export interface ProspectCampaignListResponse {
  items: ProspectCampaignItemResponse[];
  total: number;
}
