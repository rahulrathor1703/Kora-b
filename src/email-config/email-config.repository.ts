import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EmailConfigOptionEntity,
  type EmailConfigCategory,
} from './entities/email-config-option.entity';

@Injectable()
export class EmailConfigRepository {
  constructor(
    @InjectRepository(EmailConfigOptionEntity)
    private readonly repository: Repository<EmailConfigOptionEntity>,
  ) {}

  findAllByOrganizationId(
    organizationId: string,
    category?: EmailConfigCategory,
  ): Promise<EmailConfigOptionEntity[]> {
    return this.repository.find({
      where: category ? { organizationId, category } : { organizationId },
      order: { sortOrder: 'ASC', label: 'ASC' },
    });
  }

  findByIdAndOrganizationId(
    id: string,
    organizationId: string,
  ): Promise<EmailConfigOptionEntity | null> {
    return this.repository.findOne({
      where: { id, organizationId },
    });
  }

  findByOrganizationCategoryAndValue(
    organizationId: string,
    category: EmailConfigCategory,
    value: string,
  ): Promise<EmailConfigOptionEntity | null> {
    return this.repository.findOne({
      where: { organizationId, category, value },
    });
  }

  create(data: Partial<EmailConfigOptionEntity>): EmailConfigOptionEntity {
    return this.repository.create(data);
  }

  save(entity: EmailConfigOptionEntity): Promise<EmailConfigOptionEntity> {
    return this.repository.save(entity);
  }

  async deleteByIdAndOrganizationId(
    id: string,
    organizationId: string,
  ): Promise<boolean> {
    const result = await this.repository.delete({ id, organizationId });
    return (result.affected ?? 0) > 0;
  }
}
