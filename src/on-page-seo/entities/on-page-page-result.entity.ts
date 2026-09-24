import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type {
  OnPageExtendedChecks,
  SentenceCaseViolation,
} from '../types/on-page-seo.types';
import { OnPageAuditRunEntity } from './on-page-audit-run.entity';

@Entity('on_page_page_results')
@Index(['auditRunId'])
export class OnPagePageResultEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'audit_run_id' })
  auditRunId!: string;

  @Column({ length: 2048 })
  url!: string;

  @Column({ name: 'http_status', type: 'int', nullable: true })
  httpStatus!: number | null;

  @Column({ name: 'scrape_failed', type: 'boolean', default: false })
  scrapeFailed!: boolean;

  @Column({ name: 'meta_title', type: 'text', default: '' })
  metaTitle!: string;

  @Column({ name: 'meta_desc', type: 'text', default: '' })
  metaDesc!: string;

  @Column({ name: 'meta_title_length', type: 'int', default: 0 })
  metaTitleLength!: number;

  @Column({ name: 'meta_desc_length', type: 'int', default: 0 })
  metaDescLength!: number;

  @Column({ type: 'jsonb', default: [] })
  h1s!: string[];

  @Column({ type: 'jsonb', default: [] })
  h2s!: string[];

  @Column({ type: 'jsonb', default: [] })
  h3s!: string[];

  @Column({ name: 'word_count', type: 'int', default: 0 })
  wordCount!: number;

  @Column({ name: 'is_thin_content', type: 'boolean', default: false })
  isThinContent!: boolean;

  @Column({ name: 'image_count', type: 'int', default: 0 })
  imageCount!: number;

  @Column({ name: 'missing_alt_count', type: 'int', default: 0 })
  missingAltCount!: number;

  @Column({ name: 'internal_link_count', type: 'int', default: 0 })
  internalLinkCount!: number;

  @Column({ name: 'generic_anchor_count', type: 'int', default: 0 })
  genericAnchorCount!: number;

  @Column({ name: 'sentence_case_violations', type: 'jsonb', default: [] })
  sentenceCaseViolations!: SentenceCaseViolation[];

  @Column({ type: 'jsonb', default: [] })
  issues!: string[];

  @Column({ name: 'issue_count', type: 'int', default: 0 })
  issueCount!: number;

  @Column({ name: 'seo_score', type: 'int', default: 100 })
  seoScore!: number;

  @Column({ type: 'jsonb', default: {} })
  checks!: OnPageExtendedChecks;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => OnPageAuditRunEntity, (run) => run.pageResults, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'audit_run_id' })
  auditRun!: OnPageAuditRunEntity;
}
