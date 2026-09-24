import { Module, forwardRef } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { AuditLogInterceptor } from './audit-log.interceptor';
import { AuditLogResourceLabelRepository } from './audit-log-resource-label.repository';
import { AuditLogResourceLabelService } from './audit-log-resource-label.service';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsRepository } from './audit-logs.repository';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogEntity } from './entities/audit-log.entity';
import { PlatformAuditLogsController } from './platform-audit-logs.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLogEntity]),
    RbacModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [AuditLogsController, PlatformAuditLogsController],
  providers: [
    AuditLogsRepository,
    AuditLogsService,
    AuditLogResourceLabelRepository,
    AuditLogResourceLabelService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
