import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
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

  saveSchema(entity: FormSchemaEntity): Promise<FormSchemaEntity> {
    return this.repository.save(entity);
  }

  createSchema(
    formKey: string,
    organizationId: string | null,
    payload: FormSchemaPayload,
  ): FormSchemaEntity {
    return this.repository.create({
      formKey,
      organizationId,
      fields: payload.fields,
      tableColumns: payload.tableColumns ?? [],
      steps: payload.steps ?? null,
      layout: payload.layout ?? null,
      version: payload.version ?? 1,
    });
  }
}
