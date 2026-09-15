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
import { Organization } from '../../organizations/entities/organization.entity';
import { EmailCampaignEntity } from './email-campaign.entity';

@Entity('email_excluded_addresses')
@Index(['organizationId'])
@Unique(['organizationId', 'email'])
export class EmailExcludedAddressEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id' })
  organizationId!: string;

  @Column({ length: 320 })
  email!: string;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ name: 'source_campaign_id', type: 'uuid', nullable: true })
  sourceCampaignId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => EmailCampaignEntity, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'source_campaign_id' })
  sourceCampaign!: EmailCampaignEntity | null;
}
