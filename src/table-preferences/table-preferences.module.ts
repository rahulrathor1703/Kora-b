import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { TableColumnDefaultEntity } from './entities/table-column-default.entity';
import { UserTableColumnPreferenceEntity } from './entities/user-table-column-preference.entity';
import { TableColumnDefaultsRepository } from './table-column-defaults.repository';
import { TablePreferencesController } from './table-preferences.controller';
import { TablePreferencesService } from './table-preferences.service';
import { UserTableColumnPreferencesRepository } from './user-table-column-preferences.repository';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      TableColumnDefaultEntity,
      UserTableColumnPreferenceEntity,
    ]),
  ],
  controllers: [TablePreferencesController],
  providers: [
    TableColumnDefaultsRepository,
    UserTableColumnPreferencesRepository,
    TablePreferencesService,
  ],
})
export class TablePreferencesModule {}
