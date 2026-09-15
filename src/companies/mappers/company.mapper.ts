import { Injectable } from '@nestjs/common';
import type { FieldStoredValue } from '../../common/location/location-field.types';
import { CompanyFieldSchemaEntity } from '../entities/company-field-schema.entity';
import { CompanyEntity } from '../entities/company.entity';
import type { CompanyFieldDefinition } from '../types/company-field-schema';

export interface CompanyResponse {
  id: string;
  brokerName: string;
  values: Record<string, FieldStoredValue>;
  createdAt: string;
  updatedAt: string;
}

export interface CompaniesPageResponse {
  items: CompanyResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CompanyFieldSchemaResponse {
  fields: CompanyFieldDefinition[];
  fieldKeysInUse: string[];
  updatedAt: string;
}

@Injectable()
export class CompanyMapper {
  toFieldSchemaResponse(
    entity: CompanyFieldSchemaEntity,
    fieldKeysInUse: string[] = [],
  ): CompanyFieldSchemaResponse {
    const fields = [...entity.fields].sort(
      (left, right) => left.sortOrder - right.sortOrder,
    );

    return {
      fields,
      fieldKeysInUse,
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  toResponse(entity: CompanyEntity): CompanyResponse {
    return {
      id: entity.id,
      brokerName: entity.brokerName,
      values: entity.values,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  toPageResponse(
    items: CompanyEntity[],
    total: number,
    page: number,
    pageSize: number,
  ): CompaniesPageResponse {
    return {
      items: items.map((item) => this.toResponse(item)),
      total,
      page,
      pageSize,
    };
  }
}
