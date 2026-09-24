import { ForbiddenException } from '@nestjs/common';
import { getActiveOrganizationId } from './organization.context';

export function requireOrganizationId(organizationId?: string | null): string {
  const resolved = organizationId ?? getActiveOrganizationId();
  if (!resolved) {
    throw new ForbiddenException('Organization context is required');
  }
  return resolved;
}
