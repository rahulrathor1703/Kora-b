import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyEntity } from '../companies/entities/company.entity';
import { EmailCampaignEntity } from '../email-campaigns/entities/email-campaign.entity';
import { InvitationEntity } from '../invitations/entities/invitation.entity';
import { MailboxEntity } from '../mailboxes/entities/mailbox.entity';
import { WebsitePropertyEntity } from '../on-page-seo/entities/website-property.entity';
import { ProspectEntity } from '../prospects/entities/prospect.entity';
import { User } from '../users/entities/user.entity';
import type { OrgLimitCountQuery } from './org-entitlements.registry';

@Injectable()
export class OrgQuotaRepository {
  constructor(
    @InjectRepository(MailboxEntity)
    private readonly mailboxRepository: Repository<MailboxEntity>,
    @InjectRepository(EmailCampaignEntity)
    private readonly emailCampaignRepository: Repository<EmailCampaignEntity>,
    @InjectRepository(ProspectEntity)
    private readonly prospectRepository: Repository<ProspectEntity>,
    @InjectRepository(CompanyEntity)
    private readonly companyRepository: Repository<CompanyEntity>,
    @InjectRepository(WebsitePropertyEntity)
    private readonly websitePropertyRepository: Repository<WebsitePropertyEntity>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(InvitationEntity)
    private readonly invitationRepository: Repository<InvitationEntity>,
  ) {}

  countByQuery(
    organizationId: string,
    countQuery: OrgLimitCountQuery,
  ): Promise<number> {
    switch (countQuery) {
      case 'mailboxes':
        return this.mailboxRepository.count({ where: { organizationId } });
      case 'emailCampaigns':
        return this.emailCampaignRepository.count({
          where: { organizationId },
        });
      case 'prospects':
        return this.prospectRepository.count({ where: { organizationId } });
      case 'companies':
        return this.companyRepository.count({ where: { organizationId } });
      case 'websiteProjects':
        return this.websitePropertyRepository.count({
          where: { organizationId },
        });
      case 'members':
        return this.countMembers(organizationId);
      default:
        return Promise.resolve(0);
    }
  }

  private async countMembers(organizationId: string): Promise<number> {
    const [users, pendingInvitations] = await Promise.all([
      this.userRepository.count({ where: { organizationId } }),
      this.invitationRepository.count({
        where: { organizationId, status: 'pending' },
      }),
    ]);

    return users + pendingInvitations;
  }
}
