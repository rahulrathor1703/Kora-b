import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import type { ListEmailStatus } from '../list-engagement/list-engagement.types';
import { ContactListMemberEntity } from './entities/contact-list-member.entity';

export interface ContactListMembersQuery {
  search?: string;
  emailStatus?: ListEmailStatus;
  page: number;
  pageSize: number;
}

export interface PaginatedContactListMembers {
  items: ContactListMemberEntity[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class ContactListMembersRepository {
  constructor(
    @InjectRepository(ContactListMemberEntity)
    private readonly memberRepository: Repository<ContactListMemberEntity>,
  ) {}

  create(data: Partial<ContactListMemberEntity>): ContactListMemberEntity {
    return this.memberRepository.create(data);
  }

  async upsertMany(members: ContactListMemberEntity[]): Promise<void> {
    if (members.length === 0) {
      return;
    }

    await this.memberRepository.upsert(members, {
      conflictPaths: ['listId', 'email'],
      skipUpdateIfNoValuesChanged: true,
    });
  }

  findByListId(listId: string): Promise<ContactListMemberEntity[]> {
    return this.memberRepository.find({
      where: { listId },
      order: { createdAt: 'ASC' },
    });
  }

  findByListIdAndEmail(
    listId: string,
    email: string,
  ): Promise<ContactListMemberEntity | null> {
    return this.memberRepository.findOne({
      where: { listId, email: email.toLowerCase() },
    });
  }

  findByIdAndListId(
    memberId: string,
    listId: string,
  ): Promise<ContactListMemberEntity | null> {
    return this.memberRepository.findOne({
      where: { id: memberId, listId },
    });
  }

  async findPaginatedByListId(
    listId: string,
    query: ContactListMembersQuery,
    emailStatusMap?: Map<string, ListEmailStatus>,
  ): Promise<PaginatedContactListMembers> {
    const qb = this.memberRepository
      .createQueryBuilder('member')
      .where('member.listId = :listId', { listId });

    if (query.search?.trim()) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((where) => {
          where
            .where('LOWER(member.email) LIKE :search', { search })
            .orWhere('LOWER(member.firstName) LIKE :search', { search })
            .orWhere('LOWER(member.lastName) LIKE :search', { search })
            .orWhere('LOWER(member.company) LIKE :search', { search });
        }),
      );
    }

    qb.orderBy('member.createdAt', 'ASC');

    const allMatches = await qb.getMany();
    const filtered =
      query.emailStatus && emailStatusMap
        ? allMatches.filter(
            (member) =>
              emailStatusMap.get(member.email.toLowerCase()) ===
              query.emailStatus,
          )
        : allMatches;

    const total = filtered.length;
    const start = (query.page - 1) * query.pageSize;
    const items = filtered.slice(start, start + query.pageSize);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
