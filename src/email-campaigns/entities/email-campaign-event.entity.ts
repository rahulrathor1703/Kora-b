import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EmailCampaignMessageEntity } from './email-campaign-message.entity';
import { EmailCampaignRecipientEntity } from './email-campaign-recipient.entity';
import { EmailCampaignEntity } from './email-campaign.entity';

export type EmailCampaignEventType =
  | 'sent'
  | 'open'
  | 'click'
  | 'bounce'
  | 'send_failed'
  | 'reply'
  | 'unsubscribe';

export type EmailCampaignEventMetadata = {
  url?: string;
  linkIndex?: number;
  linkLabel?: string;
  userAgent?: string;
  ipAddress?: string;
  reason?: string;
  source?: 'imap' | 'smtp' | 'inferred_from_reply';
  stepOrder?: number;
  providerMessageId?: string | null;
  subject?: string | null;
  isUnique?: boolean;
  correlationMethod?:
    | 'pixel'
    | 'click_redirect'
    | 'imap_token'
    | 'imap_message_id'
    | 'imap_fallback';
};

@Entity('email_campaign_events')
@Index(['campaignId', 'occurredAt'])
@Index(['recipientId', 'occurredAt'])
@Index(['messageId'])
export class EmailCampaignEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'campaign_id' })
  campaignId!: string;

  @Column({ name: 'recipient_id' })
  recipientId!: string;

  @Column({ name: 'message_id', type: 'uuid', nullable: true })
  messageId!: string | null;

  @Column({ name: 'event_type', type: 'varchar', length: 16 })
  eventType!: EmailCampaignEventType;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  @Column({ type: 'jsonb', default: {} })
  metadata!: EmailCampaignEventMetadata;

  @ManyToOne(() => EmailCampaignEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign!: EmailCampaignEntity;

  @ManyToOne(() => EmailCampaignRecipientEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipient_id' })
  recipient!: EmailCampaignRecipientEntity;

  @ManyToOne(() => EmailCampaignMessageEntity, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'message_id' })
  message!: EmailCampaignMessageEntity | null;
}
