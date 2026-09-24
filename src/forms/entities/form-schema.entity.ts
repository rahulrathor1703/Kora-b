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
import { Organization } from '../../organizations/entities/organization.entity';
import type {
  FormFieldDefinition,
  FormLayoutConfig,
  FormTableColumnDefinition,
  FormWizardStepDefinition,
} from '../types/form-schema.types';

@Entity('form_schemas')
@Index(['formKey'])
@Index(['organizationId'])
@Unique(['formKey', 'organizationId'])
export class FormSchemaEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'form_key', type: 'varchar', length: 128 })
  formKey!: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  @Column({ type: 'jsonb', default: [] })
  fields!: FormFieldDefinition[];

  @Column({ name: 'published_fields', type: 'jsonb', default: [] })
  publishedFields!: FormFieldDefinition[];

  @Column({ name: 'table_columns', type: 'jsonb', default: [] })
  tableColumns!: FormTableColumnDefinition[];

  @Column({ name: 'published_table_columns', type: 'jsonb', default: [] })
  publishedTableColumns!: FormTableColumnDefinition[];

  @Column({ name: 'published_version', type: 'int', default: 1 })
  publishedVersion!: number;

  @Column({ type: 'jsonb', nullable: true })
  steps!: FormWizardStepDefinition[] | null;

  @Column({ name: 'published_steps', type: 'jsonb', nullable: true })
  publishedSteps!: FormWizardStepDefinition[] | null;

  @Column({ type: 'jsonb', nullable: true })
  layout!: FormLayoutConfig | null;

  @Column({ name: 'published_layout', type: 'jsonb', nullable: true })
  publishedLayout!: FormLayoutConfig | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization | null;
}
