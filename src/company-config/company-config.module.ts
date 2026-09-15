import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbacModule } from '../abac/abac.module';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { CompanyConfigController } from './company-config.controller';
import { CompanyConfigRepository } from './company-config.repository';
import { CompanyConfigService } from './company-config.service';
import { CompanyConfigOptionEntity } from './entities/company-config-option.entity';
import { CompanyConfigMapper } from './mappers/company-config.mapper';

@Module({
  imports: [
    TypeOrmModule.forFeature([CompanyConfigOptionEntity]),
    RbacModule,
    forwardRef(() => AuthModule),
    forwardRef(() => AbacModule),
  ],
  controllers: [CompanyConfigController],
  providers: [
    CompanyConfigRepository,
    CompanyConfigService,
    CompanyConfigMapper,
  ],
  exports: [CompanyConfigService, CompanyConfigRepository],
})
export class CompanyConfigModule {}
