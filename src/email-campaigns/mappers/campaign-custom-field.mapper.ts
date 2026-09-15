import { Injectable } from '@nestjs/common';
import type { EmailCampaignCustomFieldDefinitionEntity } from '../entities/email-campaign-custom-field-definition.entity';
import type { EmailCampaignCustomFieldOptionEntity } from '../entities/email-campaign-custom-field-option.entity';

export interface CampaignCustomFieldOptionResponse {
  id: string;
  label: string;
  value: string;
  isActive: boolean;
  sortOrder: number;
}

export interface CampaignCustomFieldDefinitionResponse {
  id: string;
  label: string;
  key: string;
  type: 'select' | 'text';
  isActive: boolean;
  sortOrder: number;
  options: CampaignCustomFieldOptionResponse[];
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class CampaignCustomFieldMapper {
  toDefinitionResponse(
    entity: EmailCampaignCustomFieldDefinitionEntity,
  ): CampaignCustomFieldDefinitionResponse {
    const options = [...(entity.options ?? [])].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
    );

    return {
      id: entity.id,
      label: entity.label,
      key: entity.key,
      type: entity.type,
      isActive: entity.isActive,
      sortOrder: entity.sortOrder,
      options: options.map((option) => this.toOptionResponse(option)),
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  toOptionResponse(
    entity: EmailCampaignCustomFieldOptionEntity,
  ): CampaignCustomFieldOptionResponse {
    return {
      id: entity.id,
      label: entity.label,
      value: entity.value,
      isActive: entity.isActive,
      sortOrder: entity.sortOrder,
    };
  }
}
