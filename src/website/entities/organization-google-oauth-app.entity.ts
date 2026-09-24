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

@Entity('organization_google_oauth_apps')
@Index(['organizationId'])
export class OrganizationGoogleOAuthAppEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'varchar', length: 256, default: 'Default' })
  label!: string;

  @Column({
    name: 'google_oauth_client_id',
    type: 'varchar',
    length: 512,
  })
  googleOAuthClientId!: string;

  @Column({
    name: 'google_oauth_client_secret_encrypted',
    type: 'text',
  })
  googleOAuthClientSecretEncrypted!: string;

  @Column({
    name: 'google_oauth_callback_base_url',
    type: 'varchar',
    length: 2048,
  })
  googleOAuthCallbackBaseUrl!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;
}
