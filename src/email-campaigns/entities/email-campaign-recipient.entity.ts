import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { EmailCampaignEntity } from './email-campaign.entity';

export type EmailCampaignRecipientStatus =
  'pending' | 'active' | 'completed' | 'failed';

export type EmailCampaignReplyCategory =
  'interested' | 'not_now' | 'no' | 'ooo' | 'wrong_person';

export type EmailCampaignContactDisposition =
  'eligible' | 'excluded' | 'paused' | 'stopped' | 'unsubscribed' | 'done';

@Entity('email_campaign_recipients')
@Index(['campaignId'])
@Unique(['campaignId', 'email'])
export class EmailCampaignRecipientEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'campaign_id' })
  campaignId!: string;

  @Column({ length: 320 })
  email!: string;

  @Column({ name: 'merge_fields', type: 'jsonb', default: {} })
  mergeFields!: Record<string, string>;

  @Column({ name: 'current_step_order', type: 'int', default: 1 })
  currentStepOrder!: number;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: EmailCampaignRecipientStatus;

  @Column({ name: 'next_send_at', type: 'timestamptz', nullable: true })
  nextSendAt!: Date | null;

  @Column({ name: 'last_sent_at', type: 'timestamptz', nullable: true })
  lastSentAt!: Date | null;

  @Column({
    name: 'reply_category',
    type: 'varchar',
    length: 16,
    nullable: true,
  })
  replyCategory!: EmailCampaignReplyCategory | null;

  @Column({ name: 'replied_at', type: 'timestamptz', nullable: true })
  repliedAt!: Date | null;

  @Column({
    name: 'reply_subject',
    type: 'varchar',
    length: 998,
    nullable: true,
  })
  replySubject!: string | null;

  @Column({
    name: 'contact_disposition',
    type: 'varchar',
    length: 16,
    default: 'eligible',
  })
  contactDisposition!: EmailCampaignContactDisposition;

  @Column({ name: 'paused_until', type: 'timestamptz', nullable: true })
  pausedUntil!: Date | null;

  @Column({ name: 'allow_send_despite_reply', type: 'boolean', default: false })
  allowSendDespiteReply!: boolean;

  @Column({ name: 'reply_read_at', type: 'timestamptz', nullable: true })
  replyReadAt!: Date | null;

  @Column({ name: 'reply_done_reason', type: 'text', nullable: true })
  replyDoneReason!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => EmailCampaignEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign!: EmailCampaignEntity;
}
