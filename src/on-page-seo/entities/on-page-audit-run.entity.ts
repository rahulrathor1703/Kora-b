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
import type {
  OnPageAuditRunStatus,
  OnPageAuditSummary,
} from '../types/on-page-seo.types';
import { OnPagePageResultEntity } from './on-page-page-result.entity';
import { WebsitePropertyEntity } from './website-property.entity';

@Entity('on_page_audit_runs')
@Index(['organizationId'])
@Index(['websitePropertyId', 'startedAt'])
export class OnPageAuditRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id' })
  organizationId!: string;

  @Column({ name: 'website_property_id' })
  websitePropertyId!: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: OnPageAuditRunStatus;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'pages_audited', type: 'int', default: 0 })
  pagesAudited!: number;

  @Column({ name: 'pages_failed', type: 'int', default: 0 })
  pagesFailed!: number;

  @Column({ type: 'jsonb', default: {} })
  summary!: OnPageAuditSummary;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => WebsitePropertyEntity, (property) => property.auditRuns, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'website_property_id' })
  websiteProperty!: WebsitePropertyEntity;

  @OneToMany(() => OnPagePageResultEntity, (result) => result.auditRun)
  pageResults!: OnPagePageResultEntity[];
}
