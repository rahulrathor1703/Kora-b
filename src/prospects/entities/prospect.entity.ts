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
import type { FieldStoredValue } from '../../common/location/location-field.types';
import { ProspectEngagementEntity } from './prospect-engagement.entity';

@Entity('prospects')
@Index(['organizationId'])
@Index(['organizationId', 'fullName'])
@Index(['organizationId', 'email'])
export class ProspectEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id' })
  organizationId!: string;

  @Column({ name: 'full_name', length: 255, default: '' })
  fullName!: string;

  @Column({ length: 320, default: '' })
  email!: string;

  @Column({ type: 'jsonb', default: {} })
  values!: Record<string, FieldStoredValue>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @OneToMany(
    () => ProspectEngagementEntity,
    (engagement) => engagement.prospect,
  )
  engagements!: ProspectEngagementEntity[];
}
