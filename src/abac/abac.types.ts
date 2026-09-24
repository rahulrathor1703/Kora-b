export type AbacPolicyEffect = 'allow' | 'deny';

export interface AbacHierarchyLevelCondition {
  min?: number;
  max?: number;
}

export interface AbacPolicyConditions {
  hierarchyLevel?: AbacHierarchyLevelCondition;
  roleSlugs?: string[];
  status?: 'active' | 'disabled';
}

export interface AbacPolicyAssignedUserDto {
  id: string;
  email: string;
  username: string | null;
}

export interface AbacPolicyListItemDto {
  id: string;
  name: string;
  description: string | null;
  resource: string;
  action: string;
  effect: AbacPolicyEffect;
  isEnabled: boolean;
  assignedUserCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AbacPolicyDetailDto {
  id: string;
  name: string;
  description: string | null;
  resource: string;
  action: string;
  effect: AbacPolicyEffect;
  isEnabled: boolean;
  conditions: AbacPolicyConditions;
  assignedUsers: AbacPolicyAssignedUserDto[];
  createdAt: string;
  updatedAt: string;
}

export interface UserAbacPolicySummaryDto {
  id: string;
  name: string;
  resource: string;
  action: string;
  effect: AbacPolicyEffect;
  isEnabled: boolean;
}

export type BulkAssignAbacPoliciesMode = 'add' | 'replace';

export interface BulkAssignAbacPoliciesResultDto {
  mode: BulkAssignAbacPoliciesMode;
  affectedUsers: number;
  assignmentsCreated: number;
  assignmentsRemoved: number;
}
