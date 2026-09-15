import { Injectable } from '@nestjs/common';
import type { EmailTemplateStepEntity } from '../entities/email-template-step.entity';
import type { EmailTemplateEntity } from '../entities/email-template.entity';
import type {
  EmailTemplateDelayMode,
  EmailTemplateType,
  EmailTemplateVisibility,
} from '../types/email-template.types';

export interface EmailTemplateStepResponse {
  id: string;
  stepOrder: number;
  subject: string;
  body: string;
  delayMode: EmailTemplateDelayMode;
  delayDays: number;
  scheduledDate: string | null;
}

export interface EmailTemplateResponse {
  id: string;
  name: string;
  description: string | null;
  type: EmailTemplateType;
  visibility: EmailTemplateVisibility;
  isActive: boolean;
  createdByUserId: string;
  steps: EmailTemplateStepResponse[];
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class EmailTemplateMapper {
  toResponse(entity: EmailTemplateEntity): EmailTemplateResponse {
    const steps = [...(entity.steps ?? [])].sort(
      (a, b) => a.stepOrder - b.stepOrder,
    );

    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      type: entity.type,
      visibility: entity.visibility,
      isActive: entity.isActive,
      createdByUserId: entity.createdByUserId,
      steps: steps.map((step) => this.toStepResponse(step)),
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  private toStepResponse(
    step: EmailTemplateStepEntity,
  ): EmailTemplateStepResponse {
    return {
      id: step.id,
      stepOrder: step.stepOrder,
      subject: step.subject,
      body: step.body,
      delayMode: step.delayMode,
      delayDays: step.delayDays,
      scheduledDate: step.scheduledDate,
    };
  }
}
