export interface InvitationSummary {
  id: string;
  email: string;
  roleId: string;
  roleName: string;
  hierarchyLevel: number;
  status: string;
  invitedByEmail: string;
  expiresAt: string;
  createdAt: string;
}

export interface InvitationValidation {
  email: string;
  roleName: string;
  hierarchyLevel: number;
  expiresAt: string;
}

export interface CreateInvitationResult {
  invitation: InvitationSummary;
  inviteUrl: string;
}
