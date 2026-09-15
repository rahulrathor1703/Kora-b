import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { RolesRepository } from '../src/rbac/roles.repository';
import { UserRolesRepository } from '../src/rbac/user-roles.repository';
import { UserRole } from '../src/users/entities/user.entity';
import { UsersService } from '../src/users/users.service';

const SUPERADMIN_EMAIL = 'param@gmail.com';
const SUPERADMIN_PASSWORD = 'param@123';

async function ensureUser(
  authService: AuthService,
  usersService: UsersService,
  email: string,
  password: string,
  role: UserRole,
): Promise<string> {
  const existing = await usersService.findByEmail(email);

  if (existing) {
    if (existing.role !== role) {
      await usersService.updateRole(email, role);
      console.log(`Updated seed user role: ${email} → ${role}`);
    } else {
      console.log(`Seed user already exists: ${email}`);
    }
    return existing.id;
  }

  const user = await authService.createUser(email, password, role);
  console.log(`Created seed user: ${user.email} (${user.role})`);
  return user.id;
}

async function ensureSuperAdminRbac(
  userId: string,
  userRolesRepository: UserRolesRepository,
  rolesRepository: RolesRepository,
): Promise<void> {
  const superAdminRole = await rolesRepository.findBySlug('super-admin');

  if (!superAdminRole) {
    console.warn('super-admin RBAC role not found — run the API once to seed RBAC');
    return;
  }

  const existing = await userRolesRepository.findByUserAndRole(
    userId,
    superAdminRole.id,
  );

  if (existing) {
    console.log('Superadmin already has super-admin RBAC role');
    return;
  }

  await userRolesRepository.replaceRoleForUser(userId, superAdminRole.id);
  console.log('Assigned super-admin RBAC role to platform superadmin');
}

async function seedUser(): Promise<void> {
  const adminEmail = process.env.SEED_USER_EMAIL;
  const adminPassword = process.env.SEED_USER_PASSWORD;

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const usersService = app.get(UsersService);
    const authService = app.get(AuthService);
    const userRolesRepository = app.get(UserRolesRepository);
    const rolesRepository = app.get(RolesRepository);

    const superAdminId = await ensureUser(
      authService,
      usersService,
      SUPERADMIN_EMAIL,
      SUPERADMIN_PASSWORD,
      UserRole.SUPERADMIN,
    );

    await ensureSuperAdminRbac(
      superAdminId,
      userRolesRepository,
      rolesRepository,
    );

    if (adminEmail && adminPassword) {
      await ensureUser(
        authService,
        usersService,
        adminEmail,
        adminPassword,
        UserRole.ADMIN,
      );
    } else {
      console.warn(
        'SEED_USER_EMAIL and SEED_USER_PASSWORD not set — skipping admin seed user',
      );
    }
  } finally {
    await app.close();
  }
}

void seedUser().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
