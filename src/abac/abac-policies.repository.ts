import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbacPolicyEntity } from './entities/abac-policy.entity';

@Injectable()
export class AbacPoliciesRepository {
  constructor(
    @InjectRepository(AbacPolicyEntity)
    private readonly policyRepository: Repository<AbacPolicyEntity>,
  ) {}

  findAllByOrganizationId(organizationId: string): Promise<AbacPolicyEntity[]> {
    return this.policyRepository.find({
      where: { organizationId },
      relations: { userAbacPolicies: true },
      order: { createdAt: 'ASC' },
    });
  }

  findByIdAndOrganizationId(
    id: string,
    organizationId: string,
  ): Promise<AbacPolicyEntity | null> {
    return this.policyRepository.findOne({
      where: { id, organizationId },
      relations: { userAbacPolicies: { user: true } },
    });
  }

  findByNameAndOrganizationId(
    name: string,
    organizationId: string,
  ): Promise<AbacPolicyEntity | null> {
    return this.policyRepository.findOne({ where: { name, organizationId } });
  }

  create(data: Partial<AbacPolicyEntity>): AbacPolicyEntity {
    return this.policyRepository.create(data);
  }

  save(entity: AbacPolicyEntity): Promise<AbacPolicyEntity> {
    return this.policyRepository.save(entity);
  }

  remove(entity: AbacPolicyEntity): Promise<AbacPolicyEntity> {
    return this.policyRepository.remove(entity);
  }
}
