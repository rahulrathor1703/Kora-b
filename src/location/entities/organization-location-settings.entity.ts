import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';

export type LocationProvider = 'geonames' | 'custom';

@Entity('organization_location_settings')
@Index(['organizationId'])
@Unique(['organizationId'])
export class OrganizationLocationSettingsEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'varchar', length: 16, default: 'geonames' })
  provider!: LocationProvider;

  @Column({ name: 'api_url', type: 'varchar', length: 512, nullable: true })
  apiUrl!: string | null;

  @Column({ name: 'credentials_encrypted', type: 'text', nullable: true })
  credentialsEncrypted!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;
}
