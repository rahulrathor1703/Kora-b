import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PermissionEntity } from './entities/permission.entity';
import { RolePermissionEntity } from './entities/role-permission.entity';
import { RoleEntity } from './entities/role.entity';
import { UserRoleEntity } from './entities/user-role.entity';
import { PermissionsController } from './permissions.controller';
import { PermissionsRepository } from './permissions.repository';
import { PermissionsService } from './permissions.service';
import { RbacSeedService } from './rbac.seed.service';
import { RolesController } from './roles.controller';
import { RolesRepository } from './roles.repository';
import { RolesService } from './roles.service';
import { UserRolesRepository } from './user-roles.repository';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    TypeOrmModule.forFeature([
      PermissionEntity,
      RoleEntity,
      RolePermissionEntity,
      UserRoleEntity,
    ]),
  ],
  controllers: [PermissionsController, RolesController],
  providers: [
    PermissionsRepository,
    PermissionsService,
    RolesRepository,
    RolesService,
    RbacSeedService,
    UserRolesRepository,
  ],
  exports: [UserRolesRepository, RolesRepository],
})
export class RbacModule {}
