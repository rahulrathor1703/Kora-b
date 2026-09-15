import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PermissionEntity } from './entities/permission.entity';

@Injectable()
export class PermissionsRepository {
  constructor(
    @InjectRepository(PermissionEntity)
    private readonly repository: Repository<PermissionEntity>,
  ) {}

  findAll(): Promise<PermissionEntity[]> {
    return this.repository.find({
      order: { resource: 'ASC', action: 'ASC' },
    });
  }

  findByIds(ids: string[]): Promise<PermissionEntity[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }

    return this.repository.find({ where: { id: In(ids) } });
  }

  findByKey(key: string): Promise<PermissionEntity | null> {
    return this.repository.findOne({ where: { key } });
  }

  create(data: Partial<PermissionEntity>): PermissionEntity {
    return this.repository.create(data);
  }

  save(entity: PermissionEntity): Promise<PermissionEntity> {
    return this.repository.save(entity);
  }
}
