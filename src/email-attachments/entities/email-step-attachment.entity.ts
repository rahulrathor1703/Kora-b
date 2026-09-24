import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EmailCampaignSequenceStepEntity } from '../../email-campaigns/entities/email-campaign-sequence-step.entity';
import { EmailTemplateStepEntity } from '../../email-templates/entities/email-template-step.entity';

@Entity('email_step_attachments')
@Index(['organizationId'])
@Index(['campaignStepId'])
@Index(['templateStepId'])
export class EmailStepAttachmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id' })
  organizationId!: string;

  @Column({ name: 'campaign_step_id', nullable: true })
  campaignStepId!: string | null;

  @Column({ name: 'template_step_id', nullable: true })
  templateStepId!: string | null;

  @Column({ name: 'original_filename', length: 255 })
  originalFilename!: string;

  @Column({ name: 'stored_filename', length: 255 })
  storedFilename!: string;

  @Column({ name: 'mime_type', length: 128 })
  mimeType!: string;

  @Column({ name: 'size_bytes', type: 'int' })
  sizeBytes!: number;

  @Column({ name: 'storage_path', type: 'text' })
  storagePath!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => EmailCampaignSequenceStepEntity, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'campaign_step_id' })
  campaignStep!: EmailCampaignSequenceStepEntity | null;

  @ManyToOne(() => EmailTemplateStepEntity, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'template_step_id' })
  templateStep!: EmailTemplateStepEntity | null;
}
