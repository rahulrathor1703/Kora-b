import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository, SelectQueryBuilder } from 'typeorm';
import { CompanyFieldSchemaEntity } from './entities/company-field-schema.entity';
import { CompanyEntity } from './entities/company.entity';
import { DEFAULT_COMPANY_FIELD_SCHEMA } from './types/company-field-schema';

export interface CompaniesListQuery {
  q?: string;
  filters?: Record<string, string>;
  searchableFieldKeys?: string[];
}

export interface CompaniesQuery extends CompaniesListQuery {
  page: number;
  pageSize: number;
}

export interface PaginatedCompanies {
  items: CompanyEntity[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class CompaniesRepository {
  constructor(
    @InjectRepository(CompanyEntity)
    private readonly repository: Repository<CompanyEntity>,
    @InjectRepository(CompanyFieldSchemaEntity)
    private readonly schemaRepository: Repository<CompanyFieldSchemaEntity>,
  ) {}

  findSchemaByOrganizationId(
    organizationId: string,
  ): Promise<CompanyFieldSchemaEntity | null> {
    return this.schemaRepository.findOne({ where: { organizationId } });
  }

  createSchema(organizationId: string): Promise<CompanyFieldSchemaEntity> {
    const schema = this.schemaRepository.create({
      organizationId,
      fields: DEFAULT_COMPANY_FIELD_SCHEMA.fields,
    });

    return this.schemaRepository.save(schema);
  }

  saveSchema(
    schema: CompanyFieldSchemaEntity,
  ): Promise<CompanyFieldSchemaEntity> {
    return this.schemaRepository.save(schema);
  }

  findById(id: string, organizationId: string): Promise<CompanyEntity | null> {
    return this.repository.findOne({
      where: { id, organizationId },
    });
  }

  findByBrokerName(
    brokerName: string,
    organizationId: string,
    excludeId?: string,
  ): Promise<CompanyEntity | null> {
    const qb = this.repository
      .createQueryBuilder('company')
      .where('company.organizationId = :organizationId', { organizationId })
      .andWhere('LOWER(company.brokerName) = LOWER(:brokerName)', {
        brokerName: brokerName.trim(),
      });

    if (excludeId) {
      qb.andWhere('company.id != :excludeId', { excludeId });
    }

    return qb.getOne();
  }

  create(data: Partial<CompanyEntity>): CompanyEntity {
    return this.repository.create(data);
  }

  save(entity: CompanyEntity): Promise<CompanyEntity> {
    return this.repository.save(entity);
  }

  saveMany(entities: CompanyEntity[]): Promise<CompanyEntity[]> {
    if (entities.length === 0) {
      return Promise.resolve([]);
    }

    return this.repository.save(entities);
  }

  async findExistingBrokerNamesByOrganization(
    organizationId: string,
    brokerNames: string[],
  ): Promise<Set<string>> {
    const normalizedNames = Array.from(
      new Set(
        brokerNames
          .map((name) => name.trim().toLowerCase())
          .filter((name) => name.length > 0),
      ),
    );

    if (normalizedNames.length === 0) {
      return new Set();
    }

    const matches = await this.repository
      .createQueryBuilder('company')
      .select('LOWER(company.brokerName)', 'brokerName')
      .where('company.organizationId = :organizationId', { organizationId })
      .andWhere('LOWER(company.brokerName) IN (:...brokerNames)', {
        brokerNames: normalizedNames,
      })
      .getRawMany<{ brokerName: string }>();

    return new Set(matches.map((match) => match.brokerName));
  }

  async deleteById(id: string, organizationId: string): Promise<boolean> {
    const result = await this.repository.delete({ id, organizationId });
    return (result.affected ?? 0) > 0;
  }

  async deleteByIds(organizationId: string, ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const result = await this.repository.delete({
      organizationId,
      id: In(ids),
    });

    return result.affected ?? 0;
  }

  async deleteByListQuery(
    organizationId: string,
    query: CompaniesListQuery,
  ): Promise<number> {
    const selectQb = this.createListQueryBuilder(organizationId, query).select(
      'company.id',
    );

    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .from(CompanyEntity)
      .where(`id IN (${selectQb.getQuery()})`)
      .setParameters(selectQb.getParameters())
      .execute();

    return result.affected ?? 0;
  }

  private createListQueryBuilder(
    organizationId: string,
    query: CompaniesListQuery,
  ): SelectQueryBuilder<CompanyEntity> {
    const qb = this.repository
      .createQueryBuilder('company')
      .where('company.organizationId = :organizationId', { organizationId });

    this.applyCompaniesListFilters(qb, query);

    return qb;
  }

  private applyCompaniesListFilters(
    qb: SelectQueryBuilder<CompanyEntity>,
    query: CompaniesListQuery,
  ): void {
    if (query.q?.trim()) {
      const search = `%${query.q.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((where) => {
          where.where('LOWER(company.brokerName) LIKE :search', { search });

          for (const key of query.searchableFieldKeys ?? []) {
            const paramName = `search_${key.replace(/[^a-zA-Z0-9]/g, '_')}`;
            where.orWhere(
              `LOWER(company.values ->> :${paramName}Key) LIKE :search`,
              {
                [`${paramName}Key`]: key,
                search,
              },
            );
          }
        }),
      );
    }

    if (query.filters) {
      for (const [key, value] of Object.entries(query.filters)) {
        if (!value) {
          continue;
        }

        const paramName = `filter_${key.replace(/[^a-zA-Z0-9]/g, '_')}`;
        qb.andWhere(
          `company.values ->> :${paramName}Key = :${paramName}Value`,
          {
            [`${paramName}Key`]: key,
            [`${paramName}Value`]: value,
          },
        );
      }
    }
  }

  async findPaginated(
    organizationId: string,
    query: CompaniesQuery,
  ): Promise<PaginatedCompanies> {
    const qb = this.createListQueryBuilder(organizationId, query);

    qb.orderBy('company.createdAt', 'DESC');

    const total = await qb.getCount();
    const items = await qb
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getMany();

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async removeValuesForDeletedFields(
    organizationId: string,
    deletedKeys: string[],
  ): Promise<void> {
    if (deletedKeys.length === 0) {
      return;
    }

    const companies = await this.repository.find({
      where: { organizationId },
    });

    const updatedCompanies = companies
      .map((company) => {
        let changed = false;
        const nextValues = { ...company.values };

        for (const key of deletedKeys) {
          if (key in nextValues) {
            delete nextValues[key];
            changed = true;
          }
        }

        if (!changed) {
          return null;
        }

        company.values = nextValues;
        return company;
      })
      .filter((company): company is CompanyEntity => company !== null);

    if (updatedCompanies.length > 0) {
      await this.repository.save(updatedCompanies);
    }
  }

  async findFieldKeysInUse(organizationId: string): Promise<string[]> {
    const keys = new Set<string>();

    const hasBrokerName = await this.repository
      .createQueryBuilder('company')
      .where('company.organizationId = :organizationId', { organizationId })
      .andWhere("nullif(trim(company.brokerName), '') IS NOT NULL")
      .limit(1)
      .getCount();

    if (hasBrokerName > 0) {
      keys.add('brokerName');
    }

    const jsonRows = await this.repository.manager.query<{ key: string }[]>(
      `SELECT DISTINCT kv.key AS key
       FROM companies c
       CROSS JOIN LATERAL jsonb_each(c.values) AS kv(key, value)
       WHERE c.organization_id = $1
         AND (
           (jsonb_typeof(kv.value) = 'string' AND nullif(trim(kv.value #>> '{}'), '') IS NOT NULL)
           OR jsonb_typeof(kv.value) = 'number'
           OR (
             jsonb_typeof(kv.value) = 'object'
             AND EXISTS (
               SELECT 1
               FROM jsonb_each_text(kv.value) AS loc(loc_key, loc_value)
               WHERE nullif(trim(loc_value), '') IS NOT NULL
             )
           )
         )`,
      [organizationId],
    );

    for (const row of jsonRows) {
      keys.add(row.key);
    }

    return [...keys];
  }
}
