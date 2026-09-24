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

export type MailboxProvider = 'gmail' | 'outlook' | 'smtp';

export type MailboxStatus = 'active' | 'inactive';

export type MailboxSyncStatus = 'connected' | 'error' | 'pending';

@Entity('mailboxes')
@Index(['organizationId'])
@Unique(['organizationId', 'email'])
export class MailboxEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id' })
  organizationId!: string;

  @Column({ name: 'display_name', length: 255 })
  displayName!: string;

  @Column({ length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 16 })
  provider!: MailboxProvider;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status!: MailboxStatus;

  @Column({ name: 'from_name', length: 255 })
  fromName!: string;

  @Column({ name: 'daily_send_limit', type: 'int' })
  dailySendLimit!: number;

  @Column({ name: 'daily_sends_used', type: 'int', default: 0 })
  dailySendsUsed!: number;

  @Column({ name: 'daily_sends_date', type: 'date', nullable: true })
  dailySendsDate!: string | null;

  @Column({ name: 'warmup_enabled', type: 'boolean', default: false })
  warmupEnabled!: boolean;

  @Column({
    name: 'sync_status',
    type: 'varchar',
    length: 16,
    default: 'pending',
  })
  syncStatus!: MailboxSyncStatus;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt!: Date | null;

  @Column({ name: 'smtp_host', type: 'varchar', length: 255, nullable: true })
  smtpHost!: string | null;

  @Column({ name: 'smtp_port', type: 'int', nullable: true })
  smtpPort!: number | null;

  @Column({ name: 'smtp_user', type: 'varchar', length: 255, nullable: true })
  smtpUser!: string | null;

  @Column({ name: 'smtp_secure', type: 'boolean', nullable: true })
  smtpSecure!: boolean | null;

  @Column({ name: 'credentials_encrypted', type: 'text' })
  credentialsEncrypted!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;
}
