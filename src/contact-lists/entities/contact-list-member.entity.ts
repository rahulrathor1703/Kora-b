import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { ContactListEntity } from './contact-list.entity';

@Entity('contact_list_members')
@Index(['organizationId'])
@Index(['listId'])
@Unique(['listId', 'email'])
export class ContactListMemberEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id' })
  organizationId!: string;

  @Column({ name: 'list_id' })
  listId!: string;

  @Column({ length: 320 })
  email!: string;

  @Column({ name: 'first_name', type: 'varchar', length: 255, nullable: true })
  firstName!: string | null;

  @Column({ name: 'last_name', type: 'varchar', length: 255, nullable: true })
  lastName!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  company!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  phone!: string | null;

  @Column({ name: 'custom_fields', type: 'jsonb', default: {} })
  customFields!: Record<string, string>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => ContactListEntity, (list) => list.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'list_id' })
  list!: ContactListEntity;
}
