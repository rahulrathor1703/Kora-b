import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbacModule } from '../abac/abac.module';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { EmailConfigController } from './email-config.controller';
import { EmailConfigRepository } from './email-config.repository';
import { EmailConfigService } from './email-config.service';
import { EmailConfigOptionEntity } from './entities/email-config-option.entity';
import { EmailConfigMapper } from './mappers/email-config.mapper';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailConfigOptionEntity]),
    RbacModule,
    forwardRef(() => AuthModule),
    forwardRef(() => AbacModule),
  ],
  controllers: [EmailConfigController],
  providers: [EmailConfigRepository, EmailConfigService, EmailConfigMapper],
  exports: [EmailConfigService, EmailConfigRepository],
})
export class EmailConfigModule {}
