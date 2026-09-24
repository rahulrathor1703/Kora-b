import type { Organization } from './entities/organization.entity';

export const ORGANIZATIONS_REPOSITORY = Symbol('ORGANIZATIONS_REPOSITORY');

export interface CreateOrganizationInput {
  name: string;
  slug: string;
}

export interface OrganizationListItem {
  id: string;
  name: string;
  slug: string;
  status: Organization['status'];
  createdAt: Date;
  memberCount: number;
}

export interface OrganizationsRepositoryPort {
  create(input: CreateOrganizationInput): Promise<Organization>;
  findById(id: string): Promise<Organization | null>;
  findBySlug(slug: string): Promise<Organization | null>;
  slugExists(slug: string): Promise<boolean>;
  findAllWithMemberCount(): Promise<OrganizationListItem[]>;
  countMembersByOrganizationId(organizationId: string): Promise<number>;
}
