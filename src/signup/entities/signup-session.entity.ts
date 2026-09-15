import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('signup_sessions')
export class SignupSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  token!: string;

  @Column()
  email!: string;

  @Column({ name: 'company_name', type: 'varchar', nullable: true })
  companyName!: string | null;

  @Column({ name: 'otp_hash', type: 'varchar', nullable: true })
  otpHash!: string | null;

  @Column({ name: 'otp_expires_at', type: 'timestamptz', nullable: true })
  otpExpiresAt!: Date | null;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null;

  @Column({ name: 'otp_attempts', default: 0 })
  otpAttempts!: number;

  @Column({ name: 'last_otp_sent_at', type: 'timestamptz', nullable: true })
  lastOtpSentAt!: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({
    name: 'oauth_provider',
    type: 'varchar',
    length: 16,
    nullable: true,
  })
  oauthProvider!: 'google' | 'apple' | null;

  @Column({
    name: 'oauth_subject_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  oauthSubjectId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
