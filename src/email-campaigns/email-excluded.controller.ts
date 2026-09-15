import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AbacGuard } from '../abac/abac-evaluation.service';
import { CurrentOrganizationId } from '../auth/decorators/current-organization.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import { AssignAudienceContactToListDto } from './dto/assign-audience-contact-to-list.dto';
import { CreateAudienceContactDto } from './dto/create-audience-contact.dto';
import {
  CreateEmailExcludedDto,
  ExcludeFromListDto,
} from './dto/create-email-excluded.dto';
import { EmailExcludedListContactsQueryDto } from './dto/email-excluded-list-contacts-query.dto';
import { EmailExcludedService } from './email-excluded.service';

@Controller('email-excluded')
export class EmailExcludedController {
  constructor(private readonly emailExcludedService: EmailExcludedService) {}

  @Get()
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:read')
  findAll(@CurrentOrganizationId() organizationId: string | null) {
    return this.emailExcludedService.findAll(organizationId);
  }

  @Get('list-contacts')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:read')
  findAllListContacts(
    @Query() query: EmailExcludedListContactsQueryDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailExcludedService.findAllListContacts(query, organizationId);
  }

  @Post('list-contacts')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('contact-lists:create')
  createAudienceContact(
    @Body() dto: CreateAudienceContactDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailExcludedService.createAudienceContact(dto, organizationId);
  }

  @Post('list-contacts/assign-to-list')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('contact-lists:update')
  assignAudienceContactToList(
    @Body() dto: AssignAudienceContactToListDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailExcludedService.assignAudienceContactToList(
      dto,
      organizationId,
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:update')
  add(
    @Body() dto: CreateEmailExcludedDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailExcludedService.add(dto.email, organizationId);
  }

  @Post('from-list')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:update')
  excludeFromList(
    @Body() dto: ExcludeFromListDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailExcludedService.excludeFromList(
      dto.listId,
      dto.listType,
      organizationId,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:update')
  remove(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailExcludedService.remove(id, organizationId);
  }
}
