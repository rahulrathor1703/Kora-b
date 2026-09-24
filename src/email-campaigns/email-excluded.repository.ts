import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailExcludedAddressEntity } from './entities/email-excluded-address.entity';

@Injectable()
export class EmailExcludedRepository {
  constructor(
    @InjectRepository(EmailExcludedAddressEntity)
    private readonly repository: Repository<EmailExcludedAddressEntity>,
  ) {}

  findByOrganizationId(
    organizationId: string,
  ): Promise<EmailExcludedAddressEntity[]> {
    return this.repository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  findByOrganizationIdAndEmail(
    organizationId: string,
    email: string,
  ): Promise<EmailExcludedAddressEntity | null> {
    return this.repository.findOne({
      where: { organizationId, email: email.toLowerCase() },
    });
  }

  findEmailsByOrganizationId(organizationId: string): Promise<string[]> {
    return this.repository
      .createQueryBuilder('excluded')
      .select('excluded.email', 'email')
      .where('excluded.organizationId = :organizationId', { organizationId })
      .getRawMany<{ email: string }>()
      .then((rows) => rows.map((row) => row.email.toLowerCase()));
  }

  async upsertExcludedAddress(input: {
    organizationId: string;
    email: string;
    reason: string;
    sourceCampaignId?: string | null;
  }): Promise<EmailExcludedAddressEntity> {
    const existing = await this.findByOrganizationIdAndEmail(
      input.organizationId,
      input.email,
    );

    if (existing) {
      existing.reason = input.reason;
      existing.sourceCampaignId =
        input.sourceCampaignId ?? existing.sourceCampaignId;
      return this.repository.save(existing);
    }

    const entity = this.repository.create({
      organizationId: input.organizationId,
      email: input.email.toLowerCase(),
      reason: input.reason,
      sourceCampaignId: input.sourceCampaignId ?? null,
    });

    return this.repository.save(entity);
  }

  async deleteByOrganizationIdAndEmail(
    organizationId: string,
    email: string,
  ): Promise<void> {
    await this.repository.delete({
      organizationId,
      email: email.toLowerCase(),
    });
  }

  async deleteByIdAndOrganizationId(
    id: string,
    organizationId: string,
  ): Promise<boolean> {
    const result = await this.repository.delete({ id, organizationId });
    return (result.affected ?? 0) > 0;
  }
}
