import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbacModule } from '../abac/abac.module';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { EmailTemplateStepEntity } from './entities/email-template-step.entity';
import { EmailTemplateEntity } from './entities/email-template.entity';
import { EmailTemplatesController } from './email-templates.controller';
import { EmailTemplatesRepository } from './email-templates.repository';
import { EmailTemplatesService } from './email-templates.service';
import { EmailTemplateMapper } from './mappers/email-template.mapper';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailTemplateEntity, EmailTemplateStepEntity]),
    RbacModule,
    forwardRef(() => AuthModule),
    forwardRef(() => AbacModule),
  ],
  controllers: [EmailTemplatesController],
  providers: [
    EmailTemplatesRepository,
    EmailTemplatesService,
    EmailTemplateMapper,
  ],
  exports: [EmailTemplatesService, EmailTemplatesRepository],
})
export class EmailTemplatesModule {}
