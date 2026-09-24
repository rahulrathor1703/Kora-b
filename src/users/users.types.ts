export interface TeamMemberSummary {
  id: string;
  email: string;
  username: string | null;
  roleId: string | null;
  roleName: string | null;
  hierarchyLevel: number;
  status: string;
  joinedAt: string;
}
