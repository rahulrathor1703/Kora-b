import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbacModule } from '../abac/abac.module';
import { AuthModule } from '../auth/auth.module';
import { CompaniesModule } from '../companies/companies.module';
import { ProspectsModule } from '../prospects/prospects.module';
import { CrmFormBridgeService } from './crm-form-bridge.service';
import { FormSchemaEntity } from './entities/form-schema.entity';
import { FormsController } from './forms.controller';
import { FormsRepository } from './forms.repository';
import { FormsService } from './forms.service';
import { PlatformFormsController } from './platform-forms.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([FormSchemaEntity]),
    AuthModule,
    forwardRef(() => AbacModule),
    forwardRef(() => ProspectsModule),
    forwardRef(() => CompaniesModule),
  ],
  controllers: [FormsController, PlatformFormsController],
  providers: [FormsRepository, FormsService, CrmFormBridgeService],
  exports: [FormsService],
})
export class FormsModule {}
