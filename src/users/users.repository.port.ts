import type { User, UserRole } from './entities/user.entity';

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

export interface AdminListItem {
  id: string;
  email: string;
  createdAt: Date;
}

export interface UsersRepositoryPort {
  findByEmail(email: string): Promise<User | null>;
  findByGoogleId(googleId: string): Promise<User | null>;
  findByAppleId(appleId: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  findByOrganizationId(organizationId: string): Promise<User[]>;
  create(
    email: string,
    passwordHash: string,
    role?: UserRole,
    organizationId?: string | null,
  ): Promise<User>;
  createEntity(data: Partial<User>): User;
  save(user: User): Promise<User>;
  findAllByRole(role: UserRole): Promise<AdminListItem[]>;
  updateRole(email: string, role: UserRole): Promise<User | null>;
}
