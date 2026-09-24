import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbacModule } from '../abac/abac.module';
import { AuthModule } from '../auth/auth.module';
import { ProspectEntity } from '../prospects/entities/prospect.entity';
import { RbacModule } from '../rbac/rbac.module';
import { BantSettingsController } from './bant-settings.controller';
import { BantSettingsRepository } from './bant-settings.repository';
import { BantSettingsService } from './bant-settings.service';
import { OrganizationBantSettingsEntity } from './entities/organization-bant-settings.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrganizationBantSettingsEntity, ProspectEntity]),
    RbacModule,
    forwardRef(() => AuthModule),
    forwardRef(() => AbacModule),
  ],
  controllers: [BantSettingsController],
  providers: [BantSettingsRepository, BantSettingsService],
  exports: [BantSettingsService],
})
export class BantSettingsModule {}
