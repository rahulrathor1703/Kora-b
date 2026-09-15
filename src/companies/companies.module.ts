import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbacModule } from '../abac/abac.module';
import { AuthModule } from '../auth/auth.module';
import { CompanyConfigModule } from '../company-config/company-config.module';
import { FormsModule } from '../forms/forms.module';
import { FileParserModule } from '../common/file-parser/file-parser.module';
import { OrgEntitlementsModule } from '../org-entitlements/org-entitlements.module';
import { RbacModule } from '../rbac/rbac.module';
import { CompaniesImportService } from './companies-import.service';
import { CompaniesController } from './companies.controller';
import { CompaniesRepository } from './companies.repository';
import { CompaniesService } from './companies.service';
import { CompanyFieldSchemaEntity } from './entities/company-field-schema.entity';
import { CompanyEntity } from './entities/company.entity';
import { CompanyMapper } from './mappers/company.mapper';

@Module({
  imports: [
    TypeOrmModule.forFeature([CompanyEntity, CompanyFieldSchemaEntity]),
    CompanyConfigModule,
    FileParserModule,
    FormsModule,
    RbacModule,
    forwardRef(() => AuthModule),
    forwardRef(() => AbacModule),
    OrgEntitlementsModule,
  ],
  controllers: [CompaniesController],
  providers: [
    CompaniesRepository,
    CompaniesService,
    CompanyMapper,
    CompaniesImportService,
  ],
  exports: [CompaniesService],
})
export class CompaniesModule {}
