import { Injectable } from '@nestjs/common';
import { PermissionEntity } from './entities/permission.entity';
import { PermissionsRepository } from './permissions.repository';
import type {
  PermissionDto,
  PermissionGroupDto,
  PermissionsResponse,
} from './rbac.types';

@Injectable()
export class PermissionsService {
  constructor(private readonly permissionsRepository: PermissionsRepository) {}

  async findAllGrouped(): Promise<PermissionsResponse> {
    const permissions = await this.permissionsRepository.findAll();
    const groups = this.groupPermissions(permissions);
    return { groups };
  }

  private groupPermissions(
    permissions: PermissionEntity[],
  ): PermissionGroupDto[] {
    const groupMap = new Map<string, PermissionDto[]>();

    for (const permission of permissions) {
      const dto = this.toPermissionDto(permission);
      const existing = groupMap.get(permission.resource) ?? [];
      existing.push(dto);
      groupMap.set(permission.resource, existing);
    }

    return Array.from(groupMap.entries()).map(([resource, items]) => ({
      resource,
      permissions: items,
    }));
  }

  toPermissionDto(permission: PermissionEntity): PermissionDto {
    return {
      id: permission.id,
      key: permission.key,
      resource: permission.resource,
      action: permission.action,
      description: permission.description,
    };
  }
}
