import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import type {
  CreateEmailConfigOptionDto,
  UpdateEmailConfigOptionDto,
} from './dto/email-config-option.dto';
import type { EmailConfigCategory } from './entities/email-config-option.entity';
import { EmailConfigRepository } from './email-config.repository';
import {
  EmailConfigMapper,
  type EmailConfigOptionResponse,
} from './mappers/email-config.mapper';

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
export class EmailConfigService {
  constructor(
    private readonly emailConfigRepository: EmailConfigRepository,
    private readonly emailConfigMapper: EmailConfigMapper,
  ) {}

  async findAll(
    organizationId: string | null,
    category?: EmailConfigCategory,
  ): Promise<EmailConfigOptionResponse[]> {
    const options = await this.emailConfigRepository.findAllByOrganizationId(
      requireOrganizationId(organizationId),
      category,
    );

    return options.map((option) => this.emailConfigMapper.toResponse(option));
  }

  async findOne(
    id: string,
    organizationId: string | null,
  ): Promise<EmailConfigOptionResponse> {
    const option = await this.requireOption(id, organizationId);
    return this.emailConfigMapper.toResponse(option);
  }

  async create(
    dto: CreateEmailConfigOptionDto,
    organizationId: string | null,
  ): Promise<EmailConfigOptionResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const label = dto.label.trim();
    const value = this.resolveValue(label, dto.value);

    await this.assertUniqueValue(resolvedOrganizationId, dto.category, value);

    const option = this.emailConfigRepository.create({
      organizationId: resolvedOrganizationId,
      category: dto.category,
      label,
      value,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });

    const saved = await this.emailConfigRepository.save(option);
    return this.emailConfigMapper.toResponse(saved);
  }

  async update(
    id: string,
    dto: UpdateEmailConfigOptionDto,
    organizationId: string | null,
  ): Promise<EmailConfigOptionResponse> {
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

    const saved = await this.emailConfigRepository.save(option);
    return this.emailConfigMapper.toResponse(saved);
  }

  async remove(id: string, organizationId: string | null): Promise<void> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const deleted =
      await this.emailConfigRepository.deleteByIdAndOrganizationId(
        id,
        resolvedOrganizationId,
      );

    if (!deleted) {
      throw new NotFoundException('Email configuration option not found');
    }
  }

  private async requireOption(id: string, organizationId: string | null) {
    const option = await this.emailConfigRepository.findByIdAndOrganizationId(
      id,
      requireOrganizationId(organizationId),
    );

    if (!option) {
      throw new NotFoundException('Email configuration option not found');
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
    category: EmailConfigCategory,
    value: string,
    excludeId?: string,
  ): Promise<void> {
    const existing =
      await this.emailConfigRepository.findByOrganizationCategoryAndValue(
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
