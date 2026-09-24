import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { FormSchemaEntity } from './entities/form-schema.entity';
import type { FormSchemaPayload } from './types/form-schema.types';

@Injectable()
export class FormsRepository {
  constructor(
    @InjectRepository(FormSchemaEntity)
    private readonly repository: Repository<FormSchemaEntity>,
  ) {}

  findPlatformSchema(formKey: string): Promise<FormSchemaEntity | null> {
    return this.repository.findOne({
      where: { formKey, organizationId: IsNull() },
    });
  }

  findOrgExtension(
    formKey: string,
    organizationId: string,
  ): Promise<FormSchemaEntity | null> {
    return this.repository.findOne({
      where: { formKey, organizationId },
    });
  }

  findAllPlatformSchemas(): Promise<FormSchemaEntity[]> {
    return this.repository.find({ where: { organizationId: IsNull() } });
  }

  findAllOrgExtensions(organizationId: string): Promise<FormSchemaEntity[]> {
    return this.repository.find({ where: { organizationId } });
  }

  findOrgExtensionsByFormKey(formKey: string): Promise<FormSchemaEntity[]> {
    return this.repository.find({
      where: { formKey, organizationId: Not(IsNull()) },
    });
  }

  saveSchema(entity: FormSchemaEntity): Promise<FormSchemaEntity> {
    return this.repository.save(entity);
  }

  createSchema(
    formKey: string,
    organizationId: string | null,
    payload: FormSchemaPayload,
  ): FormSchemaEntity {
    const tableColumns = payload.tableColumns ?? [];
    const isPlatform = organizationId === null;

    return this.repository.create({
      formKey,
      organizationId,
      fields: payload.fields,
      publishedFields: isPlatform ? payload.fields : [],
      tableColumns,
      publishedTableColumns: isPlatform ? tableColumns : [],
      publishedVersion: isPlatform ? (payload.version ?? 1) : 1,
      steps: payload.steps ?? null,
      publishedSteps: isPlatform ? (payload.steps ?? null) : null,
      layout: payload.layout ?? null,
      publishedLayout: isPlatform ? (payload.layout ?? null) : null,
      version: payload.version ?? 1,
    });
  }
}
