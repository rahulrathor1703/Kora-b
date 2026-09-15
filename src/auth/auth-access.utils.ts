import { UserRole } from '../users/entities/user.entity';
import type { AuthUser } from './auth.types';

type PermissionSubject = Pick<AuthUser, 'role' | 'permissions'>;

export function isSuperAdmin(user: Pick<AuthUser, 'role'>): boolean {
  return user.role === UserRole.SUPERADMIN;
}

export function hasPermission(
  user: PermissionSubject,
  permission: string,
): boolean {
  if (isSuperAdmin(user)) {
    return true;
  }

  return user.permissions.includes(permission);
}

export function hasAnyPermission(
  user: PermissionSubject,
  permissions: string[],
): boolean {
  if (isSuperAdmin(user)) {
    return true;
  }

  return permissions.some((permission) =>
    user.permissions.includes(permission),
  );
}
