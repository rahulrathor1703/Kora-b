import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { PermissionEntity } from './entities/permission.entity';
import { RoleEntity } from './entities/role.entity';
import { PermissionsRepository } from './permissions.repository';
import { PermissionsService } from './permissions.service';
import type { RoleDetailDto, RoleListItemDto } from './rbac.types';
import { RolesRepository } from './roles.repository';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class RolesService {
  constructor(
    private readonly rolesRepository: RolesRepository,
    private readonly permissionsRepository: PermissionsRepository,
    private readonly permissionsService: PermissionsService,
  ) {}

  async findAll(organizationId: string | null): Promise<RoleListItemDto[]> {
    const roles = await this.rolesRepository.findAll(
      organizationId ?? undefined,
    );
    return roles.map((role) => this.toListItemDto(role));
  }

  async findOne(id: string): Promise<RoleDetailDto> {
    const role = await this.rolesRepository.findById(id);
    if (!role) {
      throw new NotFoundException(`Role ${id} not found`);
    }

    return this.toDetailDto(role);
  }

  async create(
    organizationId: string | null,
    dto: CreateRoleDto,
  ): Promise<RoleDetailDto> {
    const slug = slugify(dto.name);
    const resolvedOrganizationId = organizationId ?? null;
    const existing = resolvedOrganizationId
      ? await this.rolesRepository.findBySlugAndOrganization(
          slug,
          resolvedOrganizationId,
        )
      : await this.rolesRepository.findBySlug(slug);
    if (existing) {
      throw new ConflictException(
        `Role with name "${dto.name}" already exists`,
      );
    }

    await this.validatePermissionIds(dto.permissionIds);

    const role = this.rolesRepository.create({
      name: dto.name.trim(),
      slug,
      description: dto.description?.trim() ?? null,
      isSystem: false,
      organizationId: resolvedOrganizationId,
    });

    const saved = await this.rolesRepository.save(role);
    await this.rolesRepository.replacePermissions(saved.id, dto.permissionIds);

    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateRoleDto): Promise<RoleDetailDto> {
    const role = await this.rolesRepository.findById(id);
    if (!role) {
      throw new NotFoundException(`Role ${id} not found`);
    }

    if (dto.name !== undefined) {
      if (role.isSystem) {
        throw new ForbiddenException('System role names cannot be changed');
      }

      const slug = slugify(dto.name);
      const existing = await this.rolesRepository.findBySlug(slug);
      if (existing && existing.id !== role.id) {
        throw new ConflictException(
          `Role with name "${dto.name}" already exists`,
        );
      }

      role.name = dto.name.trim();
      role.slug = slug;
    }

    if (dto.description !== undefined) {
      role.description = dto.description.trim() || null;
    }

    if (dto.permissionIds !== undefined) {
      await this.validatePermissionIds(dto.permissionIds);
      await this.rolesRepository.replacePermissions(id, dto.permissionIds);
    }

    await this.rolesRepository.save(role);

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const role = await this.rolesRepository.findById(id);
    if (!role) {
      throw new NotFoundException(`Role ${id} not found`);
    }

    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be deleted');
    }

    await this.rolesRepository.remove(role);
  }

  private async validatePermissionIds(permissionIds: string[]): Promise<void> {
    const permissions =
      await this.permissionsRepository.findByIds(permissionIds);

    if (permissions.length !== permissionIds.length) {
      throw new NotFoundException('One or more permissions were not found');
    }
  }

  private toListItemDto(role: RoleEntity): RoleListItemDto {
    return {
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      isSystem: role.isSystem,
      permissionCount: role.rolePermissions?.length ?? 0,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    };
  }

  private toDetailDto(role: RoleEntity): RoleDetailDto {
    const permissions = (role.rolePermissions ?? [])
      .map((rp) => rp.permission)
      .filter((p): p is PermissionEntity => p !== undefined && p !== null)
      .map((p) => this.permissionsService.toPermissionDto(p));

    return {
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      isSystem: role.isSystem,
      permissions,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    };
  }
}
