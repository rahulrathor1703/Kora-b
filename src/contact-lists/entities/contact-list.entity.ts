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
import type { ContactListFieldSchema } from '../types/contact-list-field-schema';
import { ContactListMemberEntity } from './contact-list-member.entity';

@Entity('contact_lists')
@Index(['organizationId'])
@Unique(['organizationId', 'name'])
export class ContactListEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id' })
  organizationId!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ name: 'contact_count', type: 'int', default: 0 })
  contactCount!: number;

  @Column({ name: 'field_schema', type: 'jsonb', default: {} })
  fieldSchema!: ContactListFieldSchema;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @OneToMany(() => ContactListMemberEntity, (member) => member.list, {
    cascade: true,
  })
  members!: ContactListMemberEntity[];
}
