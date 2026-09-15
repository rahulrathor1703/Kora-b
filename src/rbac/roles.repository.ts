import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { RolePermissionEntity } from './entities/role-permission.entity';
import { RoleEntity } from './entities/role.entity';

@Injectable()
export class RolesRepository {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly rolePermissionRepository: Repository<RolePermissionEntity>,
  ) {}

  findAll(organizationId?: string | null): Promise<RoleEntity[]> {
    if (organizationId) {
      return this.roleRepository.find({
        where: [{ organizationId: IsNull() }, { organizationId }],
        relations: { rolePermissions: true },
        order: { createdAt: 'ASC' },
      });
    }

    return this.roleRepository.find({
      where: { organizationId: IsNull() },
      relations: { rolePermissions: true },
      order: { createdAt: 'ASC' },
    });
  }

  findById(id: string): Promise<RoleEntity | null> {
    return this.roleRepository.findOne({
      where: { id },
      relations: { rolePermissions: { permission: true } },
    });
  }

  findBySlug(slug: string): Promise<RoleEntity | null> {
    return this.roleRepository.findOne({
      where: { slug, organizationId: IsNull() },
    });
  }

  findBySlugAndOrganization(
    slug: string,
    organizationId: string,
  ): Promise<RoleEntity | null> {
    return this.roleRepository.findOne({ where: { slug, organizationId } });
  }

  create(data: Partial<RoleEntity>): RoleEntity {
    return this.roleRepository.create(data);
  }

  save(entity: RoleEntity): Promise<RoleEntity> {
    return this.roleRepository.save(entity);
  }

  remove(entity: RoleEntity): Promise<RoleEntity> {
    return this.roleRepository.remove(entity);
  }

  async replacePermissions(
    roleId: string,
    permissionIds: string[],
  ): Promise<void> {
    await this.rolePermissionRepository.delete({ roleId });

    const uniquePermissionIds = [...new Set(permissionIds)];

    if (uniquePermissionIds.length === 0) {
      return;
    }

    const rolePermissions = uniquePermissionIds.map((permissionId) =>
      this.rolePermissionRepository.create({ roleId, permissionId }),
    );

    await this.rolePermissionRepository.save(rolePermissions);
  }
}
