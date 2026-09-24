import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { EmailTemplateEntity } from './entities/email-template.entity';
import type { EmailTemplateType } from './types/email-template.types';

@Injectable()
export class EmailTemplatesRepository {
  constructor(
    @InjectRepository(EmailTemplateEntity)
    private readonly repository: Repository<EmailTemplateEntity>,
  ) {}

  findVisibleForUser(
    organizationId: string,
    userId: string,
    options: { type?: EmailTemplateType; includeInactive?: boolean },
  ): Promise<EmailTemplateEntity[]> {
    const query = this.repository
      .createQueryBuilder('template')
      .leftJoinAndSelect('template.steps', 'step')
      .where('template.organizationId = :organizationId', { organizationId })
      .andWhere(
        new Brackets((qb) => {
          qb.where('template.visibility = :orgVisibility', {
            orgVisibility: 'org',
          }).orWhere('template.createdByUserId = :userId', { userId });
        }),
      )
      .orderBy('template.name', 'ASC')
      .addOrderBy('step.stepOrder', 'ASC');

    if (options.type) {
      query.andWhere('template.type = :type', { type: options.type });
    }

    if (!options.includeInactive) {
      query.andWhere('template.isActive = :isActive', { isActive: true });
    }

    return query.getMany();
  }

  findByIdAndOrganizationId(
    id: string,
    organizationId: string,
  ): Promise<EmailTemplateEntity | null> {
    return this.repository.findOne({
      where: { id, organizationId },
      relations: { steps: true },
      order: { steps: { stepOrder: 'ASC' } },
    });
  }

  create(data: Partial<EmailTemplateEntity>): EmailTemplateEntity {
    return this.repository.create(data);
  }

  save(entity: EmailTemplateEntity): Promise<EmailTemplateEntity> {
    return this.repository.save(entity);
  }

  remove(entity: EmailTemplateEntity): Promise<EmailTemplateEntity> {
    return this.repository.remove(entity);
  }
}
