import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TableColumnDefaultEntity } from './entities/table-column-default.entity';

@Injectable()
export class TableColumnDefaultsRepository {
  constructor(
    @InjectRepository(TableColumnDefaultEntity)
    private readonly repository: Repository<TableColumnDefaultEntity>,
  ) {}

  findByTableNameAndOrganizationId(
    tableName: string,
    organizationId: string,
  ): Promise<TableColumnDefaultEntity | null> {
    return this.repository.findOne({ where: { tableName, organizationId } });
  }

  create(data: Partial<TableColumnDefaultEntity>): TableColumnDefaultEntity {
    return this.repository.create(data);
  }

  save(entity: TableColumnDefaultEntity): Promise<TableColumnDefaultEntity> {
    return this.repository.save(entity);
  }

  remove(entity: TableColumnDefaultEntity): Promise<TableColumnDefaultEntity> {
    return this.repository.remove(entity);
  }
}
