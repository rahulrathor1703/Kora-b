import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { ManualListRowEntity } from './manual-list-row.entity';

export interface ManualListColumnDefinition {
  key: string;
  label: string;
}

@Entity('manual_lists')
@Index(['organizationId'])
@Unique(['organizationId', 'name'])
export class ManualListEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id' })
  organizationId!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ type: 'jsonb', default: [] })
  columns!: ManualListColumnDefinition[];

  @Column({ name: 'row_count', type: 'int', default: 0 })
  rowCount!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @OneToMany(() => ManualListRowEntity, (row) => row.list, {
    cascade: true,
  })
  rows!: ManualListRowEntity[];
}
