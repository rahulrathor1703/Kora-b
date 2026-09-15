import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRoleEntity } from './entities/user-role.entity';

@Injectable()
export class UserRolesRepository {
  constructor(
    @InjectRepository(UserRoleEntity)
    private readonly repository: Repository<UserRoleEntity>,
  ) {}

  findByUserId(userId: string): Promise<UserRoleEntity[]> {
    return this.repository.find({
      where: { userId },
      relations: {
        role: {
          rolePermissions: {
            permission: true,
          },
        },
      },
    });
  }

  async findPermissionKeysByUserId(userId: string): Promise<string[]> {
    const userRoles = await this.findByUserId(userId);
    const permissionKeys = new Set<string>();

    for (const userRole of userRoles) {
      for (const rolePermission of userRole.role.rolePermissions) {
        permissionKeys.add(rolePermission.permission.key);
      }
    }

    return Array.from(permissionKeys).sort();
  }

  create(data: Partial<UserRoleEntity>): UserRoleEntity {
    return this.repository.create(data);
  }

  save(entity: UserRoleEntity): Promise<UserRoleEntity> {
    return this.repository.save(entity);
  }

  findByUserAndRole(
    userId: string,
    roleId: string,
  ): Promise<UserRoleEntity | null> {
    return this.repository.findOne({ where: { userId, roleId } });
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.repository.delete({ userId });
  }

  async replaceRoleForUser(userId: string, roleId: string): Promise<void> {
    await this.deleteByUserId(userId);

    const userRole = this.create({ userId, roleId });
    await this.save(userRole);
  }
}
