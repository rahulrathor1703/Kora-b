import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { ManualListColumnDefinition } from './entities/manual-list.entity';
import { ManualListRowEntity } from './entities/manual-list-row.entity';
import { ManualListEntity } from './entities/manual-list.entity';

export interface ManualListRowInsert {
  rowIndex: number;
  data: Record<string, string>;
}

@Injectable()
export class ManualListsRepository {
  constructor(
    @InjectRepository(ManualListEntity)
    private readonly listRepository: Repository<ManualListEntity>,
    @InjectRepository(ManualListRowEntity)
    private readonly rowRepository: Repository<ManualListRowEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  findAllByOrganizationId(organizationId: string): Promise<ManualListEntity[]> {
    return this.listRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  findByIdAndOrganizationId(
    id: string,
    organizationId: string,
  ): Promise<ManualListEntity | null> {
    return this.listRepository.findOne({
      where: { id, organizationId },
    });
  }

  findRowsByListId(listId: string): Promise<ManualListRowEntity[]> {
    return this.rowRepository.find({
      where: { listId },
      order: { rowIndex: 'ASC' },
    });
  }

  async createListWithRows(
    organizationId: string,
    name: string,
    columns: ManualListColumnDefinition[],
    rows: ManualListRowInsert[],
  ): Promise<ManualListEntity> {
    return this.dataSource.transaction(async (manager) => {
      const listRepo = manager.getRepository(ManualListEntity);
      const rowRepo = manager.getRepository(ManualListRowEntity);

      const list = listRepo.create({
        organizationId,
        name,
        columns,
        rowCount: 0,
      });

      const savedList = await listRepo.save(list);

      if (rows.length > 0) {
        const rowEntities = rows.map((row) =>
          rowRepo.create({
            organizationId,
            listId: savedList.id,
            rowIndex: row.rowIndex,
            data: row.data,
          }),
        );

        await rowRepo.save(rowEntities);
      }

      savedList.rowCount = rows.length;
      return listRepo.save(savedList);
    });
  }

  async appendRow(
    list: ManualListEntity,
    data: Record<string, string>,
  ): Promise<ManualListEntity> {
    return this.dataSource.transaction(async (manager) => {
      const listRepo = manager.getRepository(ManualListEntity);
      const rowRepo = manager.getRepository(ManualListRowEntity);

      const maxRow = await rowRepo
        .createQueryBuilder('row')
        .select('MAX(row.rowIndex)', 'maxIndex')
        .where('row.listId = :listId', { listId: list.id })
        .getRawOne<{ maxIndex: string | null }>();

      const nextIndex = Number(maxRow?.maxIndex ?? -1) + 1;

      await rowRepo.save(
        rowRepo.create({
          organizationId: list.organizationId,
          listId: list.id,
          rowIndex: nextIndex,
          data,
        }),
      );

      list.rowCount += 1;
      return listRepo.save(list);
    });
  }

  async deleteRowAndDecrementCount(
    list: ManualListEntity,
    rowId: string,
  ): Promise<ManualListRowEntity | null> {
    return this.dataSource.transaction(async (manager) => {
      const listRepo = manager.getRepository(ManualListEntity);
      const rowRepo = manager.getRepository(ManualListRowEntity);

      const row = await rowRepo.findOne({
        where: { id: rowId, listId: list.id },
      });

      if (!row) {
        return null;
      }

      await rowRepo.delete({ id: row.id });
      list.rowCount = Math.max(0, list.rowCount - 1);
      await listRepo.save(list);

      return row;
    });
  }

  findRowByIdAndListId(
    rowId: string,
    listId: string,
  ): Promise<ManualListRowEntity | null> {
    return this.rowRepository.findOne({
      where: { id: rowId, listId },
    });
  }

  findRowsByIdsAndListId(
    rowIds: string[],
    listId: string,
  ): Promise<ManualListRowEntity[]> {
    if (rowIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.rowRepository
      .createQueryBuilder('row')
      .where('row.listId = :listId', { listId })
      .andWhere('row.id IN (:...rowIds)', { rowIds })
      .getMany();
  }

  async appendRows(
    list: ManualListEntity,
    rows: ManualListRowInsert[],
  ): Promise<{
    list: ManualListEntity;
    importedCount: number;
    importedRowIds: string[];
  }> {
    return this.dataSource.transaction(async (manager) => {
      const listRepo = manager.getRepository(ManualListEntity);
      const rowRepo = manager.getRepository(ManualListRowEntity);

      const maxRow = await rowRepo
        .createQueryBuilder('row')
        .select('MAX(row.rowIndex)', 'maxIndex')
        .where('row.listId = :listId', { listId: list.id })
        .getRawOne<{ maxIndex: string | null }>();

      let nextIndex = Number(maxRow?.maxIndex ?? -1) + 1;
      const rowEntities = rows.map((row) => {
        const entity = rowRepo.create({
          organizationId: list.organizationId,
          listId: list.id,
          rowIndex: nextIndex,
          data: row.data,
        });
        nextIndex += 1;
        return entity;
      });

      if (rowEntities.length > 0) {
        await rowRepo.save(rowEntities);
      }

      list.rowCount += rowEntities.length;
      const savedList = await listRepo.save(list);

      return {
        list: savedList,
        importedCount: rowEntities.length,
        importedRowIds: rowEntities.map((row) => row.id),
      };
    });
  }
}
