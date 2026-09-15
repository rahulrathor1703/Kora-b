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
import { User } from '../../users/entities/user.entity';
import { OrganizationGoogleOAuthAppEntity } from './organization-google-oauth-app.entity';

@Entity('organization_google_connections')
@Index(['oauthAppId', 'email'], { unique: true })
export class OrganizationGoogleConnectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id' })
  organizationId!: string;

  @Column({ name: 'oauth_app_id' })
  oauthAppId!: string;

  @Column()
  email!: string;

  @Column({ name: 'access_token_encrypted', type: 'text' })
  accessTokenEncrypted!: string;

  @Column({ name: 'refresh_token_encrypted', type: 'text', nullable: true })
  refreshTokenEncrypted!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  scopes!: string | null;

  @Column({ name: 'connected_by_user_id', nullable: true })
  connectedByUserId!: string | null;

  @CreateDateColumn({ name: 'connected_at' })
  connectedAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => OrganizationGoogleOAuthAppEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'oauth_app_id' })
  oauthApp!: OrganizationGoogleOAuthAppEntity;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'connected_by_user_id' })
  connectedByUser!: User | null;
}
