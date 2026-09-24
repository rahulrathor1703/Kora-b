import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { RbacModule } from '../rbac/rbac.module';
import { UsersModule } from '../users/users.module';
import { SignupSession } from './entities/signup-session.entity';
import { SignupController } from './signup.controller';
import { SignupRepository } from './signup.repository';
import { SIGNUP_REPOSITORY } from './signup.repository.port';
import { SignupService } from './signup.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SignupSession]),
    UsersModule,
    OrganizationsModule,
    AuthModule,
    MailModule,
    RbacModule,
  ],
  controllers: [SignupController],
  providers: [
    SignupService,
    {
      provide: SIGNUP_REPOSITORY,
      useClass: SignupRepository,
    },
  ],
  exports: [SignupService],
})
export class SignupModule {}
