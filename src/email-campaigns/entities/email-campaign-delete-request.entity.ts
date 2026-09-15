import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { User } from '../../users/entities/user.entity';
import { EmailCampaignEntity } from './email-campaign.entity';

export type EmailCampaignDeleteRequestStatus =
  'pending' | 'approved' | 'rejected' | 'cancelled';

@Entity('email_campaign_delete_requests')
@Index(['organizationId', 'status'])
export class EmailCampaignDeleteRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id' })
  organizationId!: string;

  @Column({ name: 'campaign_id', nullable: true })
  campaignId!: string | null;

  @Column({ name: 'campaign_name', length: 255, default: '' })
  campaignName!: string;

  @Column({ name: 'campaign_status', length: 16, default: '' })
  campaignStatus!: string;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: EmailCampaignDeleteRequestStatus;

  @Column({ name: 'requested_by_user_id' })
  requestedByUserId!: string;

  @Column({ name: 'reviewed_by_user_id', nullable: true })
  reviewedByUserId!: string | null;

  @Column({ name: 'review_note', type: 'text', nullable: true })
  reviewNote!: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => EmailCampaignEntity, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'campaign_id' })
  campaign!: EmailCampaignEntity | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requested_by_user_id' })
  requestedBy!: User;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewed_by_user_id' })
  reviewedBy!: User | null;
}
