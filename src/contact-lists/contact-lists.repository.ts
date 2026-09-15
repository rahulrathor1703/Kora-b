import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { ContactListFieldSchema } from './types/contact-list-field-schema';
import { ContactListMemberEntity } from './entities/contact-list-member.entity';
import { ContactListEntity } from './entities/contact-list.entity';

export interface ContactListMemberInsert {
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  phone: string | null;
  customFields: Record<string, string>;
}

@Injectable()
export class ContactListsRepository {
  constructor(
    @InjectRepository(ContactListEntity)
    private readonly listRepository: Repository<ContactListEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  findAllByOrganizationId(
    organizationId: string,
  ): Promise<ContactListEntity[]> {
    return this.listRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  findByIdAndOrganizationId(
    id: string,
    organizationId: string,
  ): Promise<ContactListEntity | null> {
    return this.listRepository.findOne({
      where: { id, organizationId },
    });
  }

  create(data: Partial<ContactListEntity>): ContactListEntity {
    return this.listRepository.create(data);
  }

  save(entity: ContactListEntity): Promise<ContactListEntity> {
    return this.listRepository.save(entity);
  }

  async importListWithMembers(
    organizationId: string,
    name: string,
    members: ContactListMemberInsert[],
    fieldSchema: ContactListFieldSchema,
  ): Promise<ContactListEntity> {
    return this.dataSource.transaction(async (manager) => {
      const listRepo = manager.getRepository(ContactListEntity);
      const memberRepo = manager.getRepository(ContactListMemberEntity);

      const list = listRepo.create({
        organizationId,
        name,
        contactCount: 0,
        fieldSchema,
      });

      const savedList = await listRepo.save(list);

      if (members.length > 0) {
        const memberEntities = members.map((member) =>
          memberRepo.create({
            organizationId,
            listId: savedList.id,
            email: member.email,
            firstName: member.firstName,
            lastName: member.lastName,
            company: member.company,
            phone: member.phone,
            customFields: member.customFields,
          }),
        );

        await memberRepo.upsert(memberEntities, {
          conflictPaths: ['listId', 'email'],
          skipUpdateIfNoValuesChanged: true,
        });
      }

      savedList.contactCount = members.length;
      return listRepo.save(savedList);
    });
  }

  async addMemberAndIncrementCount(
    list: ContactListEntity,
    member: ContactListMemberInsert,
  ): Promise<{ list: ContactListEntity; created: boolean }> {
    return this.dataSource.transaction(async (manager) => {
      const listRepo = manager.getRepository(ContactListEntity);
      const memberRepo = manager.getRepository(ContactListMemberEntity);

      const existing = await memberRepo.findOne({
        where: { listId: list.id, email: member.email },
      });

      if (existing) {
        throw new Error('DUPLICATE_MEMBER');
      }

      await memberRepo.save(
        memberRepo.create({
          organizationId: list.organizationId,
          listId: list.id,
          email: member.email,
          firstName: member.firstName,
          lastName: member.lastName,
          company: member.company,
          phone: member.phone,
          customFields: member.customFields,
        }),
      );

      list.contactCount += 1;
      const savedList = await listRepo.save(list);

      return { list: savedList, created: true };
    });
  }

  async deleteMemberAndDecrementCount(
    list: ContactListEntity,
    memberId: string,
  ): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const listRepo = manager.getRepository(ContactListEntity);
      const memberRepo = manager.getRepository(ContactListMemberEntity);

      const member = await memberRepo.findOne({
        where: { id: memberId, listId: list.id },
      });

      if (!member) {
        return false;
      }

      await memberRepo.delete({ id: member.id });
      list.contactCount = Math.max(0, list.contactCount - 1);
      await listRepo.save(list);

      return true;
    });
  }

  async appendMembersAndUpdateCount(
    list: ContactListEntity,
    members: ContactListMemberInsert[],
  ): Promise<{
    list: ContactListEntity;
    importedCount: number;
    importedEmails: string[];
  }> {
    return this.dataSource.transaction(async (manager) => {
      const listRepo = manager.getRepository(ContactListEntity);
      const memberRepo = manager.getRepository(ContactListMemberEntity);

      const existingMembers = await memberRepo.find({
        where: { listId: list.id },
        select: { email: true },
      });
      const existingEmails = new Set(
        existingMembers.map((member) => member.email.toLowerCase()),
      );

      const newMembers = members.filter(
        (member) => !existingEmails.has(member.email.toLowerCase()),
      );

      if (newMembers.length > 0) {
        const memberEntities = newMembers.map((member) =>
          memberRepo.create({
            organizationId: list.organizationId,
            listId: list.id,
            email: member.email,
            firstName: member.firstName,
            lastName: member.lastName,
            company: member.company,
            phone: member.phone,
            customFields: member.customFields,
          }),
        );

        await memberRepo.save(memberEntities);
      }

      list.contactCount = existingEmails.size + newMembers.length;
      const savedList = await listRepo.save(list);

      return {
        list: savedList,
        importedCount: newMembers.length,
        importedEmails: newMembers.map((member) => member.email),
      };
    });
  }
}
