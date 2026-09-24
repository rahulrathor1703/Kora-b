import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import type {
  CreateCompanyConfigOptionDto,
  UpdateCompanyConfigOptionDto,
} from './dto/company-config-option.dto';
import type { CompanyConfigCategory } from './entities/company-config-option.entity';
import { CompanyConfigRepository } from './company-config.repository';
import {
  CompanyConfigMapper,
  type CompanyConfigOptionResponse,
} from './mappers/company-config.mapper';

const MAX_VALUE_LENGTH = 64;

function slugifyLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_VALUE_LENGTH);
}

@Injectable()
export class CompanyConfigService {
  constructor(
    private readonly companyConfigRepository: CompanyConfigRepository,
    private readonly companyConfigMapper: CompanyConfigMapper,
  ) {}

  async findAll(
    organizationId: string | null,
    category?: CompanyConfigCategory,
  ): Promise<CompanyConfigOptionResponse[]> {
    const options = await this.companyConfigRepository.findAllByOrganizationId(
      requireOrganizationId(organizationId),
      category,
    );

    return options.map((option) => this.companyConfigMapper.toResponse(option));
  }

  async findOne(
    id: string,
    organizationId: string | null,
  ): Promise<CompanyConfigOptionResponse> {
    const option = await this.requireOption(id, organizationId);
    return this.companyConfigMapper.toResponse(option);
  }

  async create(
    dto: CreateCompanyConfigOptionDto,
    organizationId: string | null,
  ): Promise<CompanyConfigOptionResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const label = dto.label.trim();
    const value = this.resolveValue(label, dto.value);

    await this.assertUniqueValue(resolvedOrganizationId, dto.category, value);

    const option = this.companyConfigRepository.create({
      organizationId: resolvedOrganizationId,
      category: dto.category,
      label,
      value,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });

    const saved = await this.companyConfigRepository.save(option);
    return this.companyConfigMapper.toResponse(saved);
  }

  async update(
    id: string,
    dto: UpdateCompanyConfigOptionDto,
    organizationId: string | null,
  ): Promise<CompanyConfigOptionResponse> {
    const option = await this.requireOption(id, organizationId);

    if (dto.label !== undefined) {
      option.label = dto.label.trim();
    }

    if (dto.value !== undefined) {
      option.value = this.resolveValue(option.label, dto.value);
    }

    if (dto.isActive !== undefined) {
      option.isActive = dto.isActive;
    }

    if (dto.sortOrder !== undefined) {
      option.sortOrder = dto.sortOrder;
    }

    await this.assertUniqueValue(
      option.organizationId,
      option.category,
      option.value,
      option.id,
    );

    const saved = await this.companyConfigRepository.save(option);
    return this.companyConfigMapper.toResponse(saved);
  }

  async remove(id: string, organizationId: string | null): Promise<void> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const deleted =
      await this.companyConfigRepository.deleteByIdAndOrganizationId(
        id,
        resolvedOrganizationId,
      );

    if (!deleted) {
      throw new NotFoundException('Company configuration option not found');
    }
  }

  private async requireOption(id: string, organizationId: string | null) {
    const option = await this.companyConfigRepository.findByIdAndOrganizationId(
      id,
      requireOrganizationId(organizationId),
    );

    if (!option) {
      throw new NotFoundException('Company configuration option not found');
    }

    return option;
  }

  private resolveValue(label: string, value?: string): string {
    const trimmed = value?.trim() ?? '';
    if (trimmed) {
      return trimmed;
    }

    const slug = slugifyLabel(label);
    if (!slug) {
      throw new BadRequestException(
        'Unable to generate a value slug from the label',
      );
    }

    return slug;
  }

  private async assertUniqueValue(
    organizationId: string,
    category: CompanyConfigCategory,
    value: string,
    excludeId?: string,
  ): Promise<void> {
    const existing =
      await this.companyConfigRepository.findByOrganizationCategoryAndValue(
        organizationId,
        category,
        value,
      );

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        'An option with this value already exists for this category',
      );
    }
  }
}
