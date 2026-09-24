import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { User } from '../../users/entities/user.entity';
import { ProspectEntity } from './prospect.entity';

export type ProspectDeleteRequestStatus =
  'pending' | 'approved' | 'rejected' | 'cancelled';

@Entity('prospect_delete_requests')
@Index(['organizationId', 'status'])
export class ProspectDeleteRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id' })
  organizationId!: string;

  @Column({ name: 'prospect_id', nullable: true })
  prospectId!: string | null;

  @Column({ name: 'prospect_full_name', length: 255, default: '' })
  prospectFullName!: string;

  @Column({ name: 'prospect_email', length: 320, default: '' })
  prospectEmail!: string;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: ProspectDeleteRequestStatus;

  @Column({ name: 'requested_by_user_id' })
  requestedByUserId!: string;

  @Column({ name: 'reviewed_by_user_id', nullable: true })
  reviewedByUserId!: string | null;

  @Column({ name: 'review_note', type: 'text', nullable: true })
  reviewNote!: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => ProspectEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'prospect_id' })
  prospect!: ProspectEntity | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requested_by_user_id' })
  requestedBy!: User;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewed_by_user_id' })
  reviewedBy!: User | null;
}
