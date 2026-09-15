import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { EmailCampaignMailboxSenderEntity } from './email-campaign-mailbox-sender.entity';
import { EmailCampaignSequenceStepEntity } from './email-campaign-sequence-step.entity';

export type EmailCampaignStatus =
  'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'paused' | 'stopped';

export type EmailCampaignStatusBeforePause = 'scheduled' | 'sending';

export type AudienceListType = 'contact' | 'manual';

@Entity('email_campaigns')
@Index(['organizationId'])
export class EmailCampaignEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id' })
  organizationId!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  goal!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status!: EmailCampaignStatus;

  @Column({ name: 'campaign_type_id', type: 'uuid', nullable: true })
  campaignTypeId!: string | null;

  @Column({ name: 'brand_id', type: 'uuid', nullable: true })
  brandId!: string | null;

  @Column({ name: 'region_id', type: 'uuid', nullable: true })
  regionId!: string | null;

  @Column({ name: 'custom_field_values', type: 'jsonb', default: {} })
  customFieldValues!: Record<string, string>;

  @Column({
    name: 'audience_list_type',
    type: 'varchar',
    length: 16,
    nullable: true,
  })
  audienceListType!: AudienceListType | null;

  @Column({ name: 'audience_list_id', type: 'uuid', nullable: true })
  audienceListId!: string | null;

  @Column({ name: 'audience_count', type: 'int', default: 0 })
  audienceCount!: number;

  @Column({ name: 'launch_at', type: 'timestamptz', nullable: true })
  launchAt!: Date | null;

  @Column({ name: 'daily_batch_size', type: 'int', default: 50 })
  dailyBatchSize!: number;

  @Column({ name: 'sending_window_start_minutes', type: 'int', nullable: true })
  sendingWindowStartMinutes!: number | null;

  @Column({ name: 'sending_window_end_minutes', type: 'int', nullable: true })
  sendingWindowEndMinutes!: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  timezone!: string | null;

  @Column({
    name: 'active_weekdays',
    type: 'simple-array',
    nullable: true,
  })
  activeWeekdays!: number[] | null;

  @Column({ name: 'estimated_end_at', type: 'timestamptz', nullable: true })
  estimatedEndAt!: Date | null;

  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt!: Date | null;

  @Column({ name: 'sends_today_count', type: 'int', default: 0 })
  sendsTodayCount!: number;

  @Column({ name: 'sends_today_date', type: 'date', nullable: true })
  sendsTodayDate!: string | null;

  @Column({ name: 'paused_until', type: 'timestamptz', nullable: true })
  pausedUntil!: Date | null;

  @Column({
    name: 'status_before_pause',
    type: 'varchar',
    length: 16,
    nullable: true,
  })
  statusBeforePause!: EmailCampaignStatusBeforePause | null;

  @Column({ name: 'wizard_step_index', type: 'smallint', nullable: true })
  wizardStepIndex!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @OneToMany(() => EmailCampaignSequenceStepEntity, (step) => step.campaign, {
    cascade: true,
  })
  steps!: EmailCampaignSequenceStepEntity[];

  @OneToMany(
    () => EmailCampaignMailboxSenderEntity,
    (sender) => sender.campaign,
    { cascade: true },
  )
  mailboxSenders!: EmailCampaignMailboxSenderEntity[];
}
