import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';

export enum UserRole {
  SUPERADMIN = 'superadmin',
  ADMIN = 'admin',
}

export type UserStatus = 'active' | 'disabled';

export type AuthProvider = 'local' | 'google' | 'apple';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 30, unique: true, nullable: true })
  username!: string | null;

  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  passwordHash!: string | null;

  @Column({
    name: 'auth_provider',
    type: 'varchar',
    length: 16,
    default: 'local',
  })
  authProvider!: AuthProvider;

  @Column({ name: 'google_id', type: 'varchar', length: 255, nullable: true })
  googleId!: string | null;

  @Column({ name: 'apple_id', type: 'varchar', length: 255, nullable: true })
  appleId!: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.ADMIN })
  role!: UserRole;

  @Column({ name: 'hierarchy_level', type: 'smallint', default: 1 })
  hierarchyLevel!: number;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status!: UserStatus;

  @Column({ name: 'onboarding_step', default: 0 })
  onboardingStep!: number;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  @ManyToOne(() => Organization, (organization) => organization.users, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
