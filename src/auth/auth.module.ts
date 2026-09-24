import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { OrgEntitlementsModule } from '../org-entitlements/org-entitlements.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { RbacModule } from '../rbac/rbac.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard, LocalAuthGuard } from './guards/auth.guards';
import {
  OrganizationGuard,
  PermissionsGuard,
} from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    forwardRef(() => RbacModule),
    OrganizationsModule,
    forwardRef(() => OrgEntitlementsModule),
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.get<string>('jwt.secret') ?? 'dev-secret',
        signOptions: {
          expiresIn: parseJwtExpiresInSeconds(
            config.get<string>('jwt.expiresIn') ?? '7d',
          ),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    RolesGuard,
    JwtAuthGuard,
    LocalAuthGuard,
    PermissionsGuard,
    OrganizationGuard,
  ],
  exports: [
    AuthService,
    RolesGuard,
    JwtAuthGuard,
    PermissionsGuard,
    OrganizationGuard,
    OrganizationsModule,
  ],
})
export class AuthModule {}

function parseJwtExpiresInSeconds(expiresIn: string): number {
  const match = /^(\d+)([smhd])$/.exec(expiresIn.trim());

  if (!match) {
    return 7 * 24 * 60 * 60;
  }

  const value = Number.parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 24 * 60 * 60;
    default:
      return 7 * 24 * 60 * 60;
  }
}
