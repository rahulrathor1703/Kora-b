import { UserRole } from '../users/entities/user.entity';
import type { OrgLimitKey } from '../org-entitlements/org-entitlements.registry';
import type { OrgModule } from '../org-entitlements/org-entitlements.registry';

export interface AuthUserRole {
  id: string;
  name: string;
  slug: string;
}

export interface AuthUserOrganization {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended';
  enabledModules: OrgModule[];
  limits: Record<
    OrgLimitKey,
    {
      effective: number | null;
      used: number;
    }
  >;
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  username: string | null;
  hierarchyLevel: number;
  status: 'active' | 'disabled';
  onboardingStep: number;
  permissions: string[];
  roles: AuthUserRole[];
  organizationId: string | null;
  organization: AuthUserOrganization | null;
}

export type AuthUserProfile = AuthUser;

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  organizationId?: string | null;
}
