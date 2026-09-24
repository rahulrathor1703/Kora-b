import type { SelectQueryBuilder } from 'typeorm';
import type { EmailCampaignRecipientEntity } from './entities/email-campaign-recipient.entity';

export function applyInboxReplyListOrdering(
  qb: SelectQueryBuilder<EmailCampaignRecipientEntity>,
): SelectQueryBuilder<EmailCampaignRecipientEntity> {
  return qb
    .orderBy('recipient.replyReadAt', 'ASC', 'NULLS FIRST')
    .addOrderBy('recipient.repliedAt', 'DESC', 'NULLS LAST')
    .addOrderBy('recipient.createdAt', 'DESC');
}
