import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AuthOAuthProviderKey = 'google' | 'apple';

@Entity('platform_auth_oauth_providers')
export class PlatformAuthOAuthProviderEntity {
  @PrimaryColumn({ type: 'varchar', length: 16 })
  provider!: AuthOAuthProviderKey;

  @Column({ default: false })
  enabled!: boolean;

  @Column({ name: 'client_id', type: 'varchar', length: 512, nullable: true })
  clientId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
