import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { UserAbacPolicyEntity } from './entities/user-abac-policy.entity';

export interface UserPolicyAssignment {
  userId: string;
  policyIds: string[];
}

@Injectable()
export class UserAbacPoliciesRepository {
  constructor(
    @InjectRepository(UserAbacPolicyEntity)
    private readonly userAbacPolicyRepository: Repository<UserAbacPolicyEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  findByUserId(userId: string): Promise<UserAbacPolicyEntity[]> {
    return this.userAbacPolicyRepository.find({
      where: { userId },
      relations: { policy: true },
    });
  }

  findByPolicyId(policyId: string): Promise<UserAbacPolicyEntity[]> {
    return this.userAbacPolicyRepository.find({
      where: { policyId },
      relations: { user: true },
    });
  }

  async replaceUsersForPolicy(
    policyId: string,
    userIds: string[],
  ): Promise<void> {
    await this.userAbacPolicyRepository.delete({ policyId });

    if (userIds.length === 0) {
      return;
    }

    const assignments = userIds.map((userId) =>
      this.userAbacPolicyRepository.create({ userId, policyId }),
    );

    await this.userAbacPolicyRepository.save(assignments);
  }

  async replacePoliciesForUser(
    userId: string,
    policyIds: string[],
  ): Promise<void> {
    await this.userAbacPolicyRepository.delete({ userId });

    if (policyIds.length === 0) {
      return;
    }

    const assignments = policyIds.map((policyId) =>
      this.userAbacPolicyRepository.create({ userId, policyId }),
    );

    await this.userAbacPolicyRepository.save(assignments);
  }

  async findPolicyIdsByUserIds(
    userIds: string[],
  ): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();

    for (const userId of userIds) {
      map.set(userId, []);
    }

    if (userIds.length === 0) {
      return map;
    }

    const assignments = await this.userAbacPolicyRepository.find({
      where: { userId: In(userIds) },
      select: { userId: true, policyId: true },
    });

    for (const assignment of assignments) {
      const current = map.get(assignment.userId);

      if (current) {
        current.push(assignment.policyId);
      }
    }

    return map;
  }

  async bulkReplaceForUsers(
    assignments: UserPolicyAssignment[],
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(UserAbacPolicyEntity);

      for (const { userId, policyIds } of assignments) {
        await repository.delete({ userId });

        if (policyIds.length === 0) {
          continue;
        }

        const rows = policyIds.map((policyId) =>
          repository.create({ userId, policyId }),
        );

        await repository.save(rows);
      }
    });
  }

  countByPolicyId(policyId: string): Promise<number> {
    return this.userAbacPolicyRepository.count({ where: { policyId } });
  }

  async findEnabledPoliciesByUserId(
    userId: string,
  ): Promise<UserAbacPolicyEntity[]> {
    const assignments = await this.userAbacPolicyRepository.find({
      where: { userId },
      relations: { policy: true },
    });

    return assignments.filter((assignment) => assignment.policy.isEnabled);
  }

  async findUsersByIds(userIds: string[]): Promise<UserAbacPolicyEntity[]> {
    if (userIds.length === 0) {
      return [];
    }

    return this.userAbacPolicyRepository.find({
      where: { userId: In(userIds) },
    });
  }
}
