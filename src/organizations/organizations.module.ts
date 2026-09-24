import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './entities/organization.entity';
import { OrganizationsRepository } from './organizations.repository';
import { ORGANIZATIONS_REPOSITORY } from './organizations.repository.port';
import { OrganizationsService } from './organizations.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Organization])],
  providers: [
    OrganizationsService,
    {
      provide: ORGANIZATIONS_REPOSITORY,
      useClass: OrganizationsRepository,
    },
  ],
  exports: [OrganizationsService, ORGANIZATIONS_REPOSITORY],
})
export class OrganizationsModule {}
