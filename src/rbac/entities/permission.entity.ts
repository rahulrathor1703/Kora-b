import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('permissions')
export class PermissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, length: 64 })
  key!: string;

  @Column({ length: 64 })
  resource!: string;

  @Column({ length: 32 })
  action!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;
}
