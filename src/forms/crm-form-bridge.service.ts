import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { CompaniesService } from '../companies/companies.service';
import type { CompanyFieldDefinition } from '../companies/types/company-field-schema';
import { ProspectsService } from '../prospects/prospects.service';
import type { ProspectFieldDefinition } from '../prospects/types/prospect-field-schema';
import type { UpdateFormSchemaDto } from './dto/update-form-schema.dto';
import { FormsService } from './forms.service';
import type { ResolvedFormSchemaResponse } from './types/form-schema.types';

export const CRM_PROSPECT_CREATE_FORM_KEY = 'crm.prospect.create';
export const CRM_COMPANY_CREATE_FORM_KEY = 'crm.company.create';

const CRM_MANAGED_FORM_KEYS = new Set([
  CRM_PROSPECT_CREATE_FORM_KEY,
  CRM_COMPANY_CREATE_FORM_KEY,
]);

@Injectable()
export class CrmFormBridgeService {
  constructor(
    private readonly formsService: FormsService,
    @Inject(forwardRef(() => ProspectsService))
    private readonly prospectsService: ProspectsService,
    @Inject(forwardRef(() => CompaniesService))
    private readonly companiesService: CompaniesService,
  ) {}

  isCrmManagedFormKey(formKey: string): boolean {
    return CRM_MANAGED_FORM_KEYS.has(formKey);
  }

  async enrichGetSchema(
    formKey: string,
    organizationId: string,
    base: ResolvedFormSchemaResponse,
  ): Promise<ResolvedFormSchemaResponse> {
    if (formKey === CRM_PROSPECT_CREATE_FORM_KEY) {
      const schema = await this.prospectsService.getFieldSchema(organizationId);
      return {
        ...base,
        fields: schema.fields,
        fieldKeysInUse: schema.fieldKeysInUse,
      };
    }

    if (formKey === CRM_COMPANY_CREATE_FORM_KEY) {
      const schema = await this.companiesService.getFieldSchema(organizationId);
      return {
        ...base,
        fields: schema.fields,
        fieldKeysInUse: schema.fieldKeysInUse,
      };
    }

    return base;
  }

  async updateOrgSchema(
    formKey: string,
    dto: UpdateFormSchemaDto,
    organizationId: string,
  ): Promise<ResolvedFormSchemaResponse> {
    if (formKey === CRM_PROSPECT_CREATE_FORM_KEY) {
      await this.prospectsService.updateFieldSchema(
        { fields: dto.fields as ProspectFieldDefinition[] },
        organizationId,
      );
      return this.enrichGetSchema(
        formKey,
        organizationId,
        await this.formsService.getResolvedSchema(formKey, organizationId),
      );
    }

    if (formKey === CRM_COMPANY_CREATE_FORM_KEY) {
      await this.companiesService.updateFieldSchema(
        { fields: dto.fields as CompanyFieldDefinition[] },
        organizationId,
      );
      return this.enrichGetSchema(
        formKey,
        organizationId,
        await this.formsService.getResolvedSchema(formKey, organizationId),
      );
    }

    return this.formsService.updateOrgExtensions(formKey, dto, organizationId);
  }
}
