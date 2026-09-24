import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailStepAttachmentEntity } from './entities/email-step-attachment.entity';

@Injectable()
export class EmailAttachmentsRepository {
  constructor(
    @InjectRepository(EmailStepAttachmentEntity)
    private readonly repository: Repository<EmailStepAttachmentEntity>,
  ) {}

  findByCampaignStepId(
    campaignStepId: string,
  ): Promise<EmailStepAttachmentEntity[]> {
    return this.repository.find({
      where: { campaignStepId },
      order: { createdAt: 'ASC' },
    });
  }

  findByTemplateStepId(
    templateStepId: string,
  ): Promise<EmailStepAttachmentEntity[]> {
    return this.repository.find({
      where: { templateStepId },
      order: { createdAt: 'ASC' },
    });
  }

  countByCampaignStepId(campaignStepId: string): Promise<number> {
    return this.repository.count({ where: { campaignStepId } });
  }

  countByTemplateStepId(templateStepId: string): Promise<number> {
    return this.repository.count({ where: { templateStepId } });
  }

  findByIdAndOrganizationId(
    id: string,
    organizationId: string,
  ): Promise<EmailStepAttachmentEntity | null> {
    return this.repository.findOne({ where: { id, organizationId } });
  }

  save(entity: EmailStepAttachmentEntity): Promise<EmailStepAttachmentEntity> {
    return this.repository.save(entity);
  }

  remove(
    entity: EmailStepAttachmentEntity,
  ): Promise<EmailStepAttachmentEntity> {
    return this.repository.remove(entity);
  }

  findByCampaignStepIds(
    campaignStepIds: string[],
  ): Promise<EmailStepAttachmentEntity[]> {
    if (campaignStepIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.repository
      .createQueryBuilder('attachment')
      .where('attachment.campaign_step_id IN (:...campaignStepIds)', {
        campaignStepIds,
      })
      .orderBy('attachment.created_at', 'ASC')
      .getMany();
  }
}
