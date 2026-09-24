import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { AbacPolicyConditions, AbacPolicyEffect } from '../abac.types';
import { UserAbacPolicyEntity } from './user-abac-policy.entity';

@Entity('abac_policies')
@Index(['organizationId'])
export class AbacPolicyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id' })
  organizationId!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ length: 50 })
  resource!: string;

  @Column({ length: 50 })
  action!: string;

  @Column({ type: 'varchar', length: 8 })
  effect!: AbacPolicyEffect;

  @Column({ name: 'is_enabled', default: true })
  isEnabled!: boolean;

  @Column({ type: 'jsonb', default: {} })
  conditions!: AbacPolicyConditions;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(
    () => UserAbacPolicyEntity,
    (userAbacPolicy) => userAbacPolicy.policy,
  )
  userAbacPolicies!: UserAbacPolicyEntity[];
}
