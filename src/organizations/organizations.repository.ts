import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { User } from '../users/entities/user.entity';
import type {
  CreateOrganizationInput,
  OrganizationListItem,
  OrganizationsRepositoryPort,
} from './organizations.repository.port';

@Injectable()
export class OrganizationsRepository implements OrganizationsRepositoryPort {
  constructor(
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
  ) {}

  create(input: CreateOrganizationInput): Promise<Organization> {
    const organization = this.organizations.create({
      name: input.name.trim(),
      slug: input.slug,
      status: 'active',
    });
    return this.organizations.save(organization);
  }

  findById(id: string): Promise<Organization | null> {
    return this.organizations.findOne({ where: { id } });
  }

  findBySlug(slug: string): Promise<Organization | null> {
    return this.organizations.findOne({
      where: { slug: slug.toLowerCase() },
    });
  }

  slugExists(slug: string): Promise<boolean> {
    return this.organizations.exists({
      where: { slug: slug.toLowerCase() },
    });
  }

  async findAllWithMemberCount(): Promise<OrganizationListItem[]> {
    const organizations = await this.organizations.find({
      order: { createdAt: 'DESC' },
    });

    return Promise.all(
      organizations.map(async (organization) => ({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        status: organization.status,
        createdAt: organization.createdAt,
        memberCount: await this.countMembersByOrganizationId(organization.id),
      })),
    );
  }

  countMembersByOrganizationId(organizationId: string): Promise<number> {
    return this.organizations.manager.count(User, {
      where: { organizationId },
    });
  }
}
