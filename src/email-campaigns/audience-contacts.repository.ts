import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AudienceContactEntity } from './entities/audience-contact.entity';

export interface CreateAudienceContactInput {
  organizationId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  phone?: string | null;
  customFields?: Record<string, string>;
}

@Injectable()
export class AudienceContactsRepository {
  constructor(
    @InjectRepository(AudienceContactEntity)
    private readonly repository: Repository<AudienceContactEntity>,
  ) {}

  findByOrganizationId(
    organizationId: string,
  ): Promise<AudienceContactEntity[]> {
    return this.repository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  findByOrganizationIdAndEmail(
    organizationId: string,
    email: string,
  ): Promise<AudienceContactEntity | null> {
    return this.repository.findOne({
      where: { organizationId, email: email.toLowerCase() },
    });
  }

  create(input: CreateAudienceContactInput): Promise<AudienceContactEntity> {
    const entity = this.repository.create({
      organizationId: input.organizationId,
      email: input.email.toLowerCase(),
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      company: input.company ?? null,
      phone: input.phone ?? null,
      customFields: input.customFields ?? {},
    });

    return this.repository.save(entity);
  }

  async deleteByOrganizationIdAndEmail(
    organizationId: string,
    email: string,
  ): Promise<boolean> {
    const result = await this.repository.delete({
      organizationId,
      email: email.toLowerCase(),
    });

    return (result.affected ?? 0) > 0;
  }
}
