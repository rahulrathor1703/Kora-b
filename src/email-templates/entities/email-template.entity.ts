import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  EmailTemplateType,
  EmailTemplateVisibility,
} from '../types/email-template.types';
import { EmailTemplateStepEntity } from './email-template-step.entity';

@Entity('email_templates')
@Index(['organizationId'])
@Index(['createdByUserId'])
export class EmailTemplateEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id' })
  organizationId!: string;

  @Column({ name: 'created_by_user_id' })
  createdByUserId!: string;

  @Column({ length: 120 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 16 })
  type!: EmailTemplateType;

  @Column({ type: 'varchar', length: 16, default: 'private' })
  visibility!: EmailTemplateVisibility;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @OneToMany(() => EmailTemplateStepEntity, (step) => step.template, {
    cascade: true,
  })
  steps!: EmailTemplateStepEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
