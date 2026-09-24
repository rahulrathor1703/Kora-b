import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  isReservedOrganizationSlug,
  slugifyOrganizationName,
} from './organization-slug.util';
import {
  ORGANIZATIONS_REPOSITORY,
  type OrganizationsRepositoryPort,
} from './organizations.repository.port';
import type { Organization } from './entities/organization.entity';

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(ORGANIZATIONS_REPOSITORY)
    private readonly organizationsRepository: OrganizationsRepositoryPort,
  ) {}

  async create(name: string, preferredSlug?: string): Promise<Organization> {
    const slug = await this.resolveAvailableSlug(name, preferredSlug);
    return this.organizationsRepository.create({ name, slug });
  }

  findById(id: string): Promise<Organization | null> {
    return this.organizationsRepository.findById(id);
  }

  findBySlug(slug: string): Promise<Organization | null> {
    return this.organizationsRepository.findBySlug(slug);
  }

  async isSlugAvailable(slug: string): Promise<boolean> {
    const normalized = slugifyOrganizationName(slug);

    if (normalized.length < 3) {
      return false;
    }

    if (isReservedOrganizationSlug(normalized)) {
      return false;
    }

    return !(await this.organizationsRepository.slugExists(normalized));
  }

  async resolveAvailableSlug(
    name: string,
    preferredSlug?: string,
  ): Promise<string> {
    const baseSlug = slugifyOrganizationName(preferredSlug ?? name);

    if (baseSlug.length < 3) {
      throw new BadRequestException(
        'Organization name must produce a slug of at least 3 characters',
      );
    }

    if (isReservedOrganizationSlug(baseSlug)) {
      throw new BadRequestException('Organization slug is reserved');
    }

    let candidate = baseSlug;
    let suffix = 2;

    while (await this.organizationsRepository.slugExists(candidate)) {
      const suffixText = `-${suffix}`;
      candidate = `${baseSlug.slice(0, 64 - suffixText.length)}${suffixText}`;
      suffix += 1;
    }

    return candidate;
  }
}
