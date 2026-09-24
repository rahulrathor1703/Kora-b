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
import { ManualListEntity } from './manual-list.entity';

@Entity('manual_list_rows')
@Index(['organizationId'])
@Index(['listId'])
export class ManualListRowEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id' })
  organizationId!: string;

  @Column({ name: 'list_id' })
  listId!: string;

  @Column({ name: 'row_index', type: 'int' })
  rowIndex!: number;

  @Column({ type: 'jsonb', default: {} })
  data!: Record<string, string>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => ManualListEntity, (list) => list.rows, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'list_id' })
  list!: ManualListEntity;
}
