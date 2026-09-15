import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTableColumnPreferenceEntity } from './entities/user-table-column-preference.entity';

@Injectable()
export class UserTableColumnPreferencesRepository {
  constructor(
    @InjectRepository(UserTableColumnPreferenceEntity)
    private readonly repository: Repository<UserTableColumnPreferenceEntity>,
  ) {}

  findByUserAndTableName(
    userId: string,
    tableName: string,
  ): Promise<UserTableColumnPreferenceEntity | null> {
    return this.repository.findOne({ where: { userId, tableName } });
  }

  create(
    data: Partial<UserTableColumnPreferenceEntity>,
  ): UserTableColumnPreferenceEntity {
    return this.repository.create(data);
  }

  save(
    entity: UserTableColumnPreferenceEntity,
  ): Promise<UserTableColumnPreferenceEntity> {
    return this.repository.save(entity);
  }

  remove(
    entity: UserTableColumnPreferenceEntity,
  ): Promise<UserTableColumnPreferenceEntity> {
    return this.repository.remove(entity);
  }
}
