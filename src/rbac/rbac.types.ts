export interface PermissionDto {
  id: string;
  key: string;
  resource: string;
  action: string;
  description: string | null;
}

export interface PermissionGroupDto {
  resource: string;
  permissions: PermissionDto[];
}

export interface PermissionsResponse {
  groups: PermissionGroupDto[];
}

export interface RoleListItemDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  permissionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoleDetailDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  permissions: PermissionDto[];
  createdAt: string;
  updatedAt: string;
}
