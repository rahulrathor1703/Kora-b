import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EmailCampaignEntity } from './email-campaign.entity';

export type EmailCampaignMailboxSenderStatus = 'active' | 'paused' | 'stopped';

@Entity('email_campaign_mailbox_senders')
@Index(['campaignId'])
export class EmailCampaignMailboxSenderEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'campaign_id' })
  campaignId!: string;

  @Column({ name: 'mailbox_id' })
  mailboxId!: string;

  @Column({ name: 'sender_name', length: 255 })
  senderName!: string;

  @Column({ name: 'sender_email', length: 255 })
  senderEmail!: string;

  @Column({ type: 'text', nullable: true })
  signature!: string | null;

  @Column({ name: 'daily_send_quota', type: 'int', nullable: true })
  dailySendQuota!: number | null;

  @Column({ name: 'sends_today_count', type: 'int', default: 0 })
  sendsTodayCount!: number;

  @Column({ name: 'sends_today_date', type: 'date', nullable: true })
  sendsTodayDate!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: EmailCampaignMailboxSenderStatus;

  @ManyToOne(() => EmailCampaignEntity, (campaign) => campaign.mailboxSenders, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'campaign_id' })
  campaign!: EmailCampaignEntity;
}
