import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { EmailCampaignCustomFieldDefinitionEntity } from './email-campaign-custom-field-definition.entity';

@Entity('email_campaign_custom_field_options')
@Index(['fieldDefinitionId'])
@Unique(['fieldDefinitionId', 'value'])
export class EmailCampaignCustomFieldOptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'field_definition_id' })
  fieldDefinitionId!: string;

  @Column({ length: 120 })
  label!: string;

  @Column({ length: 64 })
  value!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(
    () => EmailCampaignCustomFieldDefinitionEntity,
    (definition) => definition.options,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'field_definition_id' })
  fieldDefinition!: EmailCampaignCustomFieldDefinitionEntity;
}
