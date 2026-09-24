import { Injectable } from '@nestjs/common';
import type { EmailConfigOptionEntity } from '../entities/email-config-option.entity';

export interface EmailConfigOptionResponse {
  id: string;
  category: EmailConfigOptionEntity['category'];
  value: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class EmailConfigMapper {
  toResponse(entity: EmailConfigOptionEntity): EmailConfigOptionResponse {
    return {
      id: entity.id,
      category: entity.category,
      value: entity.value,
      label: entity.label,
      isActive: entity.isActive,
      sortOrder: entity.sortOrder,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
