import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { EmailTemplateDelayMode } from '../types/email-template.types';
import { EmailTemplateEntity } from './email-template.entity';

@Entity('email_template_steps')
@Index(['templateId'])
@Unique(['templateId', 'stepOrder'])
export class EmailTemplateStepEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'template_id' })
  templateId!: string;

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

  @ManyToOne(() => EmailTemplateEntity, (template) => template.steps, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'template_id' })
  template!: EmailTemplateEntity;
}
