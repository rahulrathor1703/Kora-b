import { Injectable } from '@nestjs/common';
import type { CompanyConfigOptionEntity } from '../entities/company-config-option.entity';

export interface CompanyConfigOptionResponse {
  id: string;
  category: CompanyConfigOptionEntity['category'];
  value: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class CompanyConfigMapper {
  toResponse(entity: CompanyConfigOptionEntity): CompanyConfigOptionResponse {
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
