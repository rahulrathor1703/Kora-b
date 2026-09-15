import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { AbacEvaluationService, AbacGuard } from './abac-evaluation.service';
import { AbacPoliciesController } from './abac-policies.controller';
import { AbacPoliciesRepository } from './abac-policies.repository';
import { AbacPoliciesService } from './abac-policies.service';
import { AbacPolicyEntity } from './entities/abac-policy.entity';
import { UserAbacPolicyEntity } from './entities/user-abac-policy.entity';
import { UserAbacPoliciesRepository } from './user-abac-policies.repository';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    UsersModule,
    TypeOrmModule.forFeature([AbacPolicyEntity, UserAbacPolicyEntity]),
  ],
  controllers: [AbacPoliciesController],
  providers: [
    AbacPoliciesRepository,
    UserAbacPoliciesRepository,
    AbacPoliciesService,
    AbacEvaluationService,
    AbacGuard,
  ],
  exports: [
    AbacPoliciesService,
    AbacEvaluationService,
    AbacGuard,
    UserAbacPoliciesRepository,
  ],
})
export class AbacModule {}
