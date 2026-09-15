import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { hasPermission } from '../auth/auth-access.utils';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import type {
  CreateEmailTemplateDto,
  CreateEmailTemplateStepDto,
  UpdateEmailTemplateDto,
} from './dto/email-template.dto';
import { EmailTemplateStepEntity } from './entities/email-template-step.entity';
import { EmailTemplateEntity } from './entities/email-template.entity';
import { EmailTemplatesRepository } from './email-templates.repository';
import {
  EmailTemplateMapper,
  type EmailTemplateResponse,
} from './mappers/email-template.mapper';
import type { EmailTemplateType } from './types/email-template.types';

@Injectable()
export class EmailTemplatesService {
  constructor(
    private readonly emailTemplatesRepository: EmailTemplatesRepository,
    private readonly emailTemplateMapper: EmailTemplateMapper,
  ) {}

  async findAll(
    organizationId: string | null,
    user: AuthUser,
    options: { type?: EmailTemplateType; includeInactive?: boolean },
  ): Promise<EmailTemplateResponse[]> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const templates = await this.emailTemplatesRepository.findVisibleForUser(
      resolvedOrganizationId,
      user.id,
      options,
    );

    return templates.map((template) =>
      this.emailTemplateMapper.toResponse(template),
    );
  }

  async findOne(
    id: string,
    organizationId: string | null,
    user: AuthUser,
  ): Promise<EmailTemplateResponse> {
    const template = await this.requireVisibleTemplate(
      id,
      organizationId,
      user,
    );
    return this.emailTemplateMapper.toResponse(template);
  }

  async create(
    dto: CreateEmailTemplateDto,
    organizationId: string | null,
    user: AuthUser,
  ): Promise<EmailTemplateResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    this.validateSteps(dto.type, dto.steps);

    const template = this.emailTemplatesRepository.create({
      organizationId: resolvedOrganizationId,
      createdByUserId: user.id,
      name: dto.name.trim(),
      description: dto.description?.trim() ?? null,
      type: dto.type,
      visibility: dto.visibility ?? 'private',
      isActive: dto.isActive ?? true,
      steps: this.buildStepEntities(dto.steps),
    });

    const saved = await this.emailTemplatesRepository.save(template);
    return this.emailTemplateMapper.toResponse(saved);
  }

  async update(
    id: string,
    dto: UpdateEmailTemplateDto,
    organizationId: string | null,
    user: AuthUser,
  ): Promise<EmailTemplateResponse> {
    const template = await this.requireManageableTemplate(
      id,
      organizationId,
      user,
    );

    if (dto.name !== undefined) {
      template.name = dto.name.trim();
    }

    if (dto.description !== undefined) {
      template.description = dto.description.trim() || null;
    }

    if (dto.visibility !== undefined) {
      template.visibility = dto.visibility;
    }

    if (dto.isActive !== undefined) {
      template.isActive = dto.isActive;
    }

    if (dto.steps !== undefined) {
      this.validateSteps(template.type, dto.steps);
      template.steps = this.buildStepEntities(dto.steps);
    }

    const saved = await this.emailTemplatesRepository.save(template);
    return this.emailTemplateMapper.toResponse(saved);
  }

  async remove(
    id: string,
    organizationId: string | null,
    user: AuthUser,
  ): Promise<void> {
    const template = await this.requireManageableTemplate(
      id,
      organizationId,
      user,
    );
    await this.emailTemplatesRepository.remove(template);
  }

  private async requireVisibleTemplate(
    id: string,
    organizationId: string | null,
    user: AuthUser,
  ): Promise<EmailTemplateEntity> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const template =
      await this.emailTemplatesRepository.findByIdAndOrganizationId(
        id,
        resolvedOrganizationId,
      );

    if (!template) {
      throw new NotFoundException('Email template not found');
    }

    const isVisible =
      template.visibility === 'org' || template.createdByUserId === user.id;

    if (!isVisible) {
      throw new NotFoundException('Email template not found');
    }

    return template;
  }

  private async requireManageableTemplate(
    id: string,
    organizationId: string | null,
    user: AuthUser,
  ): Promise<EmailTemplateEntity> {
    const template = await this.requireVisibleTemplate(
      id,
      organizationId,
      user,
    );

    const canManageOrgTemplate =
      template.visibility === 'org' &&
      hasPermission(user, 'email-templates:manage');
    const canManageOwnTemplate =
      template.createdByUserId === user.id &&
      hasPermission(user, 'email-templates:manage');

    if (!canManageOrgTemplate && !canManageOwnTemplate) {
      throw new ForbiddenException('You cannot modify this email template');
    }

    return template;
  }

  private validateSteps(
    type: EmailTemplateType,
    steps: CreateEmailTemplateStepDto[],
  ): void {
    if (steps.length === 0) {
      throw new BadRequestException('Template must contain at least one step');
    }

    const sorted = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
    const orders = sorted.map((step) => step.stepOrder);

    for (let index = 0; index < orders.length; index += 1) {
      if (orders[index] !== index + 1) {
        throw new BadRequestException(
          'Template steps must have consecutive stepOrder values starting at 1',
        );
      }
    }

    if (type === 'single') {
      if (sorted.length !== 1) {
        throw new BadRequestException(
          'Single email templates must contain exactly one step',
        );
      }

      return;
    }

    const initial = sorted[0];
    if ((initial.delayMode ?? 'relative') !== 'relative') {
      throw new BadRequestException(
        'Initial outreach step must use relative timing',
      );
    }

    if ((initial.delayDays ?? 0) !== 0) {
      throw new BadRequestException(
        'Initial outreach step must have delayDays of 0',
      );
    }

    for (const step of sorted.slice(1)) {
      this.validateFollowUpTiming(step);
    }
  }

  private validateFollowUpTiming(step: CreateEmailTemplateStepDto): void {
    const delayMode = step.delayMode ?? 'relative';

    if (delayMode === 'relative') {
      const delayDays = step.delayDays ?? 0;
      if (delayDays < 1 || delayDays > 90) {
        throw new BadRequestException(
          'Follow-up steps with relative timing must have delayDays between 1 and 90',
        );
      }
      return;
    }

    if (!step.scheduledDate) {
      throw new BadRequestException(
        'Follow-up steps with absolute timing must include scheduledDate',
      );
    }
  }

  private buildStepEntities(
    steps: CreateEmailTemplateStepDto[],
  ): EmailTemplateStepEntity[] {
    return [...steps]
      .sort((a, b) => a.stepOrder - b.stepOrder)
      .map((step) => {
        const entity = new EmailTemplateStepEntity();
        entity.stepOrder = step.stepOrder;
        entity.subject = step.subject.trim();
        entity.body = step.body.trim();

        if (step.stepOrder === 1) {
          entity.delayMode = 'relative';
          entity.delayDays = 0;
          entity.scheduledDate = null;
          return entity;
        }

        const delayMode = step.delayMode ?? 'relative';
        entity.delayMode = delayMode;

        if (delayMode === 'absolute') {
          entity.delayDays = 0;
          entity.scheduledDate = step.scheduledDate ?? null;
        } else {
          entity.delayDays = step.delayDays ?? 1;
          entity.scheduledDate = null;
        }

        return entity;
      });
  }
}
