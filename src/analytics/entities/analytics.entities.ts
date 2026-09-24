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
import { User } from '../../users/entities/user.entity';
import type {
  AnalyticsChartType,
  AnalyticsDashboardVisibility,
  AnalyticsFilters,
  AnalyticsGroupBy,
  AnalyticsMetric,
} from '../types/analytics.types';

@Entity('analytics_dashboards')
@Index(['organizationId'])
@Index(['createdByUserId'])
export class AnalyticsDashboardEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id' })
  organizationId!: string;

  @Column({ name: 'created_by_user_id' })
  createdByUserId!: string;

  @Column({ length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 16, default: 'private' })
  visibility!: AnalyticsDashboardVisibility;

  @Column({ name: 'global_filters', type: 'jsonb', default: {} })
  globalFilters!: AnalyticsFilters;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser!: User;

  @OneToMany(() => AnalyticsWidgetEntity, (widget) => widget.dashboard, {
    cascade: true,
  })
  widgets?: AnalyticsWidgetEntity[];
}

@Entity('analytics_widgets')
@Index(['dashboardId'])
export class AnalyticsWidgetEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'dashboard_id' })
  dashboardId!: string;

  @Column({ length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 32 })
  metric!: AnalyticsMetric;

  @Column({ name: 'group_by', type: 'varchar', length: 32 })
  groupBy!: AnalyticsGroupBy;

  @Column({ name: 'chart_type', type: 'varchar', length: 16 })
  chartType!: AnalyticsChartType;

  @Column({ type: 'jsonb', default: {} })
  filters!: AnalyticsFilters;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => AnalyticsDashboardEntity, (dashboard) => dashboard.widgets, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'dashboard_id' })
  dashboard?: AnalyticsDashboardEntity;
}
