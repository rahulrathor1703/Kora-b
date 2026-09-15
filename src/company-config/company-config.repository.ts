import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CompanyConfigOptionEntity,
  type CompanyConfigCategory,
} from './entities/company-config-option.entity';

@Injectable()
export class CompanyConfigRepository {
  constructor(
    @InjectRepository(CompanyConfigOptionEntity)
    private readonly repository: Repository<CompanyConfigOptionEntity>,
  ) {}

  findAllByOrganizationId(
    organizationId: string,
    category?: CompanyConfigCategory,
  ): Promise<CompanyConfigOptionEntity[]> {
    return this.repository.find({
      where: category ? { organizationId, category } : { organizationId },
      order: { sortOrder: 'ASC', label: 'ASC' },
    });
  }

  findByIdAndOrganizationId(
    id: string,
    organizationId: string,
  ): Promise<CompanyConfigOptionEntity | null> {
    return this.repository.findOne({
      where: { id, organizationId },
    });
  }

  findByOrganizationCategoryAndValue(
    organizationId: string,
    category: CompanyConfigCategory,
    value: string,
  ): Promise<CompanyConfigOptionEntity | null> {
    return this.repository.findOne({
      where: { organizationId, category, value },
    });
  }

  create(data: Partial<CompanyConfigOptionEntity>): CompanyConfigOptionEntity {
    return this.repository.create(data);
  }

  save(entity: CompanyConfigOptionEntity): Promise<CompanyConfigOptionEntity> {
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
