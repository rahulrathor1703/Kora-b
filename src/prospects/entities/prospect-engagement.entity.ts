import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ProspectEntity } from './prospect.entity';

export type ProspectEngagementType =
  'call' | 'meeting' | 'email' | 'linkedin' | 'whatsapp' | 'status_change';

export const USER_CREATABLE_ENGAGEMENT_TYPES = [
  'call',
  'email',
  'meeting',
  'linkedin',
  'whatsapp',
] as const satisfies readonly ProspectEngagementType[];

export type UserCreatableProspectEngagementType =
  (typeof USER_CREATABLE_ENGAGEMENT_TYPES)[number];

export const PROSPECT_ENGAGEMENT_TYPES: ProspectEngagementType[] = [
  ...USER_CREATABLE_ENGAGEMENT_TYPES,
  'status_change',
];
export type ProspectEngagementOutcome =
  'positive' | 'neutral' | 'negative' | 'no-answer';

@Entity('prospect_engagements')
@Index(['prospectId'])
export class ProspectEngagementEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'prospect_id' })
  prospectId!: string;

  @Column({ type: 'varchar', length: 32 })
  type!: ProspectEngagementType;

  @Column({ type: 'text' })
  discussion!: string;

  @Column({ type: 'varchar', length: 32 })
  outcome!: ProspectEngagementOutcome;

  @Column({ name: 'next_step', type: 'varchar', length: 500, nullable: true })
  nextStep!: string | null;

  @Column({
    name: 'from_stage_value',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  fromStageValue!: string | null;

  @Column({
    name: 'to_stage_value',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  toStageValue!: string | null;

  @Column({
    name: 'from_stage_label',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  fromStageLabel!: string | null;

  @Column({
    name: 'to_stage_label',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  toStageLabel!: string | null;

  @Column({ name: 'created_by_id', nullable: true })
  createdById!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => ProspectEntity, (prospect) => prospect.engagements, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'prospect_id' })
  prospect!: ProspectEntity;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: User | null;
}
