import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  InvitationEntity,
  InvitationStatus,
} from './entities/invitation.entity';

@Injectable()
export class InvitationsRepository {
  constructor(
    @InjectRepository(InvitationEntity)
    private readonly repository: Repository<InvitationEntity>,
  ) {}

  findAllPendingByOrganizationId(
    organizationId: string,
  ): Promise<InvitationEntity[]> {
    return this.repository.find({
      where: { organizationId, status: 'pending' },
      relations: { role: true, invitedBy: true },
      order: { createdAt: 'DESC' },
    });
  }

  findById(id: string): Promise<InvitationEntity | null> {
    return this.repository.findOne({
      where: { id },
      relations: { role: true, invitedBy: true },
    });
  }

  findByIdAndOrganizationId(
    id: string,
    organizationId: string,
  ): Promise<InvitationEntity | null> {
    return this.repository.findOne({
      where: { id, organizationId },
      relations: { role: true, invitedBy: true },
    });
  }

  findPendingByEmailAndOrganizationId(
    email: string,
    organizationId: string,
  ): Promise<InvitationEntity | null> {
    return this.repository.findOne({
      where: { email, organizationId, status: 'pending' },
    });
  }

  findByTokenHash(tokenHash: string): Promise<InvitationEntity | null> {
    return this.repository.findOne({
      where: { tokenHash },
      relations: { role: true },
    });
  }

  create(data: Partial<InvitationEntity>): InvitationEntity {
    return this.repository.create(data);
  }

  save(entity: InvitationEntity): Promise<InvitationEntity> {
    return this.repository.save(entity);
  }

  async updateStatus(
    id: string,
    status: InvitationStatus,
    acceptedAt?: Date,
  ): Promise<void> {
    await this.repository.update(id, {
      status,
      ...(acceptedAt ? { acceptedAt } : {}),
    });
  }
}
