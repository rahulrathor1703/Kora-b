import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  GoneException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AbacGuard } from '../abac/abac-evaluation.service';
import { CurrentOrganizationId } from '../auth/decorators/current-organization.decorator';
import { RequireAnyPermissions } from '../auth/decorators/require-any-permissions.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import { RequireModule } from '../org-entitlements/decorators/require-module.decorator';
import { ModuleAccessGuard } from '../org-entitlements/guards/module-access.guard';
import {
  BulkDeleteCompaniesDto,
  CompaniesQueryDto,
  CreateCompanyDto,
  UpdateCompanyDto,
} from './dto/company.dto';
import { CompaniesService } from './companies.service';
import { CompaniesImportService } from './companies-import.service';
import { CrmImportDto } from '../common/crm-import/dto/crm-import.dto';

@Controller('companies')
@UseGuards(
  JwtAuthGuard,
  OrganizationGuard,
  ModuleAccessGuard,
  PermissionsGuard,
  AbacGuard,
)
@RequireModule('crm')
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly companiesImportService: CompaniesImportService,
  ) {}

  @Get('field-schema')
  @RequirePermissions('companies:read')
  getFieldSchema(@CurrentOrganizationId() organizationId: string | null) {
    return this.companiesService.getFieldSchema(organizationId);
  }

  @Put('field-schema')
  updateFieldSchema() {
    throw new GoneException(
      'Company field schema is managed in Settings → Manage Forms (crm.company.create).',
    );
  }

  @Get()
  @RequireAnyPermissions('companies:read', 'prospects:create')
  findCompanies(
    @Query() query: CompaniesQueryDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.companiesService.findCompanies(query, organizationId);
  }

  @Post('bulk-delete')
  @RequirePermissions('companies:delete')
  bulkRemove(
    @Body() dto: BulkDeleteCompaniesDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.companiesService.bulkRemove(dto, organizationId);
  }

  @Get(':id')
  @RequirePermissions('companies:read')
  findOne(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.companiesService.findOne(id, organizationId);
  }

  @Post('import/preview')
  @RequirePermissions('companies:create')
  @UseInterceptors(FileInterceptor('file'))
  previewImport(
    @UploadedFile() file: Express.Multer.File,
    @Body('payload') payloadJson: string | undefined,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    const fieldMapping = this.parseOptionalFieldMapping(payloadJson);
    return this.companiesImportService.previewImport(
      file,
      organizationId,
      fieldMapping,
    );
  }

  @Post('import')
  @RequirePermissions('companies:create')
  @UseInterceptors(FileInterceptor('file'))
  async importCompanies(
    @UploadedFile() file: Express.Multer.File,
    @Body('payload') payloadJson: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    const dto = await this.parseImportPayload(payloadJson);
    return this.companiesImportService.importRows(
      file,
      dto.fieldMapping,
      organizationId,
    );
  }

  @Post()
  @RequirePermissions('companies:create')
  create(
    @Body() dto: CreateCompanyDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.companiesService.create(dto, organizationId);
  }

  @Patch(':id')
  @RequirePermissions('companies:update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.companiesService.update(id, dto, organizationId);
  }

  @Delete(':id')
  @RequirePermissions('companies:delete')
  remove(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.companiesService.remove(id, organizationId);
  }

  private parseOptionalFieldMapping(
    payloadJson: string | undefined,
  ): Record<string, string> | undefined {
    if (!payloadJson) {
      return undefined;
    }

    let parsedPayload: unknown;

    try {
      parsedPayload = JSON.parse(payloadJson) as unknown;
    } catch {
      throw new BadRequestException('Import payload must be valid JSON');
    }

    const dto = plainToInstance(CrmImportDto, parsedPayload);
    return dto.fieldMapping;
  }

  private async parseImportPayload(payloadJson: string): Promise<CrmImportDto> {
    if (!payloadJson) {
      throw new BadRequestException('Import payload is required');
    }

    let parsedPayload: unknown;

    try {
      parsedPayload = JSON.parse(payloadJson) as unknown;
    } catch {
      throw new BadRequestException('Import payload must be valid JSON');
    }

    const dto = plainToInstance(CrmImportDto, parsedPayload);
    const errors = await validate(dto);

    if (errors.length > 0) {
      throw new BadRequestException('Invalid import payload');
    }

    return dto;
  }
}
