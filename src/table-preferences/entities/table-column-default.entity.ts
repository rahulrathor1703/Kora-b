import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type { StoredColumnPref } from '../types/stored-column-pref';

@Entity('table_column_defaults')
@Unique(['organizationId', 'tableName'])
export class TableColumnDefaultEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'table_name', length: 64 })
  tableName!: string;

  @Column({ type: 'jsonb' })
  columns!: StoredColumnPref[];

  @Column({ name: 'updated_by_user_id', type: 'uuid', nullable: true })
  updatedByUserId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
