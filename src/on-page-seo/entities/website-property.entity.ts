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
import { OrganizationGoogleConnectionEntity } from '../../website/entities/organization-google-connection.entity';
import { OnPageAuditRunEntity } from './on-page-audit-run.entity';

@Entity('website_properties')
@Index(['organizationId'])
export class WebsitePropertyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id' })
  organizationId!: string;

  @Column({ length: 120 })
  name!: string;

  @Column({ length: 255 })
  domain!: string;

  @Column({ name: 'sitemap_url', length: 512 })
  sitemapUrl!: string;

  @Column({ name: 'max_pages', type: 'int', default: 20 })
  maxPages!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'ga4_enabled', type: 'boolean', default: false })
  ga4Enabled!: boolean;

  @Column({
    name: 'ga4_property_id',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  ga4PropertyId!: string | null;

  @Column({
    name: 'ga4_property_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  ga4PropertyName!: string | null;

  @Column({ name: 'gsc_enabled', type: 'boolean', default: false })
  gscEnabled!: boolean;

  @Column({
    name: 'gsc_site_url',
    type: 'varchar',
    length: 512,
    nullable: true,
  })
  gscSiteUrl!: string | null;

  @Column({ name: 'psi_enabled', type: 'boolean', default: false })
  psiEnabled!: boolean;

  @Column({ name: 'google_connection_id', nullable: true })
  googleConnectionId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => OrganizationGoogleConnectionEntity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'google_connection_id' })
  googleConnection!: OrganizationGoogleConnectionEntity | null;

  @OneToMany(() => OnPageAuditRunEntity, (run) => run.websiteProperty)
  auditRuns!: OnPageAuditRunEntity[];
}
