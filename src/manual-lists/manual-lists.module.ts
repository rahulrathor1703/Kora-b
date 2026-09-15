import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbacModule } from '../abac/abac.module';
import { AuthModule } from '../auth/auth.module';
import { ContactListsModule } from '../contact-lists/contact-lists.module';
import { FormsModule } from '../forms/forms.module';
import { ListCampaignSyncModule } from '../list-campaign-sync/list-campaign-sync.module';
import { ListEngagementModule } from '../list-engagement/list-engagement.module';
import { ProspectsModule } from '../prospects/prospects.module';
import { RbacModule } from '../rbac/rbac.module';
import { ManualListRowEntity } from './entities/manual-list-row.entity';
import { ManualListEntity } from './entities/manual-list.entity';
import { ManualListMapper } from './mappers/manual-list.mapper';
import { ManualListsController } from './manual-lists.controller';
import { ManualListsRepository } from './manual-lists.repository';
import { ManualListsService } from './manual-lists.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ManualListEntity, ManualListRowEntity]),
    RbacModule,
    ListEngagementModule,
    forwardRef(() => ListCampaignSyncModule),
    forwardRef(() => ContactListsModule),
    FormsModule,
    forwardRef(() => ProspectsModule),
    forwardRef(() => AuthModule),
    forwardRef(() => AbacModule),
  ],
  controllers: [ManualListsController],
  providers: [ManualListsRepository, ManualListsService, ManualListMapper],
  exports: [ManualListsService, ManualListsRepository],
})
export class ManualListsModule {}
