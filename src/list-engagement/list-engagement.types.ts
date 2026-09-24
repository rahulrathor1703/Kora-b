export type ListEmailStatus = 'not_contacted' | 'sent' | 'replied' | 'bounced';

export interface ListEngagementStats {
  totalContacts: number;
  eligible: number;
  sent: number;
  replied: number;
}

export interface LinkedCampaignSummary {
  id: string;
  name: string;
  status: string;
  audienceCount: number;
  createdAt: string;
}
