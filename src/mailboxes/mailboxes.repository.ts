import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MailboxEntity, MailboxStatus } from './entities/mailbox.entity';

@Injectable()
export class MailboxesRepository {
  constructor(
    @InjectRepository(MailboxEntity)
    private readonly repository: Repository<MailboxEntity>,
  ) {}

  findAllByOrganizationId(organizationId: string): Promise<MailboxEntity[]> {
    return this.repository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  findAllActive(): Promise<MailboxEntity[]> {
    return this.repository.find({
      where: { status: 'active' },
      order: { createdAt: 'ASC' },
    });
  }

  findByIdAndOrganizationId(
    id: string,
    organizationId: string,
  ): Promise<MailboxEntity | null> {
    return this.repository.findOne({
      where: { id, organizationId },
    });
  }

  findByIdsAndOrganizationId(
    ids: string[],
    organizationId: string,
  ): Promise<MailboxEntity[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }

    return this.repository.find({
      where: { id: In(ids), organizationId },
    });
  }

  findByEmailAndOrganizationId(
    email: string,
    organizationId: string,
  ): Promise<MailboxEntity | null> {
    return this.repository.findOne({
      where: { email: email.toLowerCase(), organizationId },
    });
  }

  create(data: Partial<MailboxEntity>): MailboxEntity {
    return this.repository.create(data);
  }

  save(entity: MailboxEntity): Promise<MailboxEntity> {
    return this.repository.save(entity);
  }

  async updateStatus(
    id: string,
    organizationId: string,
    status: MailboxStatus,
  ): Promise<MailboxEntity | null> {
    const mailbox = await this.findByIdAndOrganizationId(id, organizationId);
    if (!mailbox) {
      return null;
    }

    mailbox.status = status;
    return this.repository.save(mailbox);
  }

  async deleteByIdAndOrganizationId(
    id: string,
    organizationId: string,
  ): Promise<boolean> {
    const result = await this.repository.delete({ id, organizationId });
    return (result.affected ?? 0) > 0;
  }
}
