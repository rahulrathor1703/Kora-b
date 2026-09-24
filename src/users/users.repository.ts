import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import type {
  AdminListItem,
  UsersRepositoryPort,
} from './users.repository.port';

@Injectable()
export class UsersRepository implements UsersRepositoryPort {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: email.toLowerCase() } });
  }

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.users.findOne({ where: { googleId } });
  }

  findByAppleId(appleId: string): Promise<User | null> {
    return this.users.findOne({ where: { appleId } });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.users.findOne({ where: { username } });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({
      where: { id },
      relations: { organization: true },
    });
  }

  findByOrganizationId(organizationId: string): Promise<User[]> {
    return this.users.find({
      where: { organizationId },
      order: { createdAt: 'ASC' },
    });
  }

  createEntity(data: Partial<User>): User {
    return this.users.create(data);
  }

  save(user: User): Promise<User> {
    return this.users.save(user);
  }

  async create(
    email: string,
    passwordHash: string,
    role: UserRole = UserRole.ADMIN,
    organizationId: string | null = null,
  ): Promise<User> {
    const user = this.users.create({
      email: email.toLowerCase(),
      passwordHash,
      role,
      organizationId,
    });

    return this.users.save(user);
  }

  async findAllByRole(role: UserRole): Promise<AdminListItem[]> {
    const users = await this.users.find({
      where: { role },
      order: { createdAt: 'DESC' },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });

    return users;
  }

  async updateRole(email: string, role: UserRole): Promise<User | null> {
    const user = await this.findByEmail(email);

    if (!user) {
      return null;
    }

    user.role = role;
    return this.users.save(user);
  }
}
