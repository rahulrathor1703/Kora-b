import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { EmailTemplateDelayMode } from '../../email-templates/types/email-template.types';
import { EmailCampaignEntity } from './email-campaign.entity';

@Entity('email_campaign_sequence_steps')
@Index(['campaignId'])
@Unique(['campaignId', 'stepOrder'])
export class EmailCampaignSequenceStepEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'campaign_id' })
  campaignId!: string;

  @Column({ name: 'step_order', type: 'int' })
  stepOrder!: number;

  @Column({ length: 255 })
  subject!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({
    name: 'delay_mode',
    type: 'varchar',
    length: 16,
    default: 'relative',
  })
  delayMode!: EmailTemplateDelayMode;

  @Column({ name: 'delay_days', type: 'int', default: 0 })
  delayDays!: number;

  @Column({ name: 'scheduled_date', type: 'date', nullable: true })
  scheduledDate!: string | null;

  @Column({ name: 'include_signature', type: 'boolean', default: true })
  includeSignature!: boolean;

  @ManyToOne(() => EmailCampaignEntity, (campaign) => campaign.steps, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'campaign_id' })
  campaign!: EmailCampaignEntity;
}
