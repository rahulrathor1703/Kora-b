import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { EmailCampaignCustomFieldOptionEntity } from './email-campaign-custom-field-option.entity';

export type EmailCampaignCustomFieldType = 'select' | 'text';

@Entity('email_campaign_custom_field_definitions')
@Index(['organizationId'])
@Unique(['organizationId', 'key'])
export class EmailCampaignCustomFieldDefinitionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id' })
  organizationId!: string;

  @Column({ length: 120 })
  label!: string;

  @Column({ length: 64 })
  key!: string;

  @Column({ type: 'varchar', length: 16 })
  type!: EmailCampaignCustomFieldType;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @OneToMany(
    () => EmailCampaignCustomFieldOptionEntity,
    (option) => option.fieldDefinition,
  )
  options!: EmailCampaignCustomFieldOptionEntity[];
}
