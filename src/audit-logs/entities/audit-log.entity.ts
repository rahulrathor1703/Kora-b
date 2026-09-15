import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { User } from '../../users/entities/user.entity';
import type {
  AuditLogAction,
  AuditLogMetadata,
  AuditLogModule,
} from '../audit-log.types';

@Entity('audit_logs')
@Index(['organizationId', 'createdAt'])
@Index(['organizationId', 'module', 'createdAt'])
@Index(['organizationId', 'action', 'createdAt'])
@Index(['actorUserId', 'createdAt'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId!: string | null;

  @Column({ name: 'actor_name', type: 'text', default: '' })
  actorName!: string;

  @Column({ name: 'actor_email', type: 'text', default: '' })
  actorEmail!: string;

  @Column({ type: 'text' })
  module!: AuditLogModule;

  @Column({ type: 'text' })
  action!: AuditLogAction;

  @Column({ name: 'http_method', type: 'text' })
  httpMethod!: string;

  @Column({ name: 'request_path', type: 'text' })
  requestPath!: string;

  @Column({ name: 'status_code', type: 'int' })
  statusCode!: number;

  @Column({ type: 'text' })
  message!: string;

  @Column({ name: 'resource_type', type: 'text', nullable: true })
  resourceType!: string | null;

  @Column({ name: 'resource_id', type: 'text', nullable: true })
  resourceId!: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata!: AuditLogMetadata;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_user_id' })
  actor!: User | null;
}
