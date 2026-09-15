import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EmailCampaignRecipientEntity } from './email-campaign-recipient.entity';
import { EmailCampaignEntity } from './email-campaign.entity';

export type EmailCampaignMessageDeliveryStatus =
  'pending' | 'sent' | 'bounced' | 'failed';

export type TrackedLink = {
  index: number;
  url: string;
  label: string;
};

@Entity('email_campaign_messages')
@Index(['campaignId'])
@Index(['recipientId'])
@Index(['trackingToken'], { unique: true })
@Index(['providerMessageId'])
export class EmailCampaignMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'campaign_id' })
  campaignId!: string;

  @Column({ name: 'recipient_id' })
  recipientId!: string;

  @Column({ name: 'step_order', type: 'int' })
  stepOrder!: number;

  @Column({ name: 'mailbox_id', type: 'uuid', nullable: true })
  mailboxId!: string | null;

  @Column({
    name: 'sent_subject',
    type: 'varchar',
    length: 998,
    nullable: true,
  })
  sentSubject!: string | null;

  @Column({ name: 'tracking_token', type: 'uuid' })
  trackingToken!: string;

  @Column({
    name: 'provider_message_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  providerMessageId!: string | null;

  @Column({ name: 'delivery_status', type: 'varchar', length: 16 })
  deliveryStatus!: EmailCampaignMessageDeliveryStatus;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt!: Date | null;

  @Column({ name: 'bounced_at', type: 'timestamptz', nullable: true })
  bouncedAt!: Date | null;

  @Column({ name: 'bounce_reason', type: 'text', nullable: true })
  bounceReason!: string | null;

  @Column({ name: 'opened_at', type: 'timestamptz', nullable: true })
  openedAt!: Date | null;

  @Column({ name: 'open_count', type: 'int', default: 0 })
  openCount!: number;

  @Column({ name: 'clicked_at', type: 'timestamptz', nullable: true })
  clickedAt!: Date | null;

  @Column({ name: 'click_count', type: 'int', default: 0 })
  clickCount!: number;

  @Column({ name: 'tracked_links', type: 'jsonb', default: [] })
  trackedLinks!: TrackedLink[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => EmailCampaignEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign!: EmailCampaignEntity;

  @ManyToOne(() => EmailCampaignRecipientEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipient_id' })
  recipient!: EmailCampaignRecipientEntity;
}
