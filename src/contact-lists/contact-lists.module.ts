import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbacModule } from '../abac/abac.module';
import { AuthModule } from '../auth/auth.module';
import { ListCampaignSyncModule } from '../list-campaign-sync/list-campaign-sync.module';
import { ListEngagementModule } from '../list-engagement/list-engagement.module';
import { ProspectsModule } from '../prospects/prospects.module';
import { RbacModule } from '../rbac/rbac.module';
import { ContactListMembersRepository } from './contact-list-members.repository';
import { ContactListsController } from './contact-lists.controller';
import { ContactListsRepository } from './contact-lists.repository';
import { ContactListsService } from './contact-lists.service';
import { ContactListMemberEntity } from './entities/contact-list-member.entity';
import { ContactListEntity } from './entities/contact-list.entity';
import { FileParserModule } from '../common/file-parser/file-parser.module';
import { FormsModule } from '../forms/forms.module';
import { ContactListMapper } from './mappers/contact-list.mapper';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContactListEntity, ContactListMemberEntity]),
    FileParserModule,
    FormsModule,
    RbacModule,
    ListEngagementModule,
    forwardRef(() => ListCampaignSyncModule),
    forwardRef(() => ProspectsModule),
    forwardRef(() => AuthModule),
    forwardRef(() => AbacModule),
  ],
  controllers: [ContactListsController],
  providers: [
    ContactListsRepository,
    ContactListMembersRepository,
    ContactListsService,
    ContactListMapper,
  ],
  exports: [
    ContactListsService,
    ContactListsRepository,
    ContactListMembersRepository,
    FileParserModule,
  ],
})
export class ContactListsModule {}
