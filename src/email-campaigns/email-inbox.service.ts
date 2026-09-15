import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import { EmailCampaignRecipientsRepository } from './email-campaign-recipients.repository';
import type { EmailInboxQueryDto } from './dto/email-inbox-query.dto';
import type { MarkInboxReplyDoneDto } from './dto/mark-inbox-reply-done.dto';
import {
  EmailInboxMapper,
  type EmailInboxReplyResponse,
  type PaginatedEmailInboxRepliesResponse,
} from './mappers/email-inbox.mapper';

@Injectable()
export class EmailInboxService {
  constructor(
    private readonly recipientsRepository: EmailCampaignRecipientsRepository,
    private readonly emailInboxMapper: EmailInboxMapper,
  ) {}

  async listReplies(
    organizationId: string | null,
    query: EmailInboxQueryDto,
  ): Promise<PaginatedEmailInboxRepliesResponse> {
    const orgId = requireOrganizationId(organizationId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const { items, total } =
      await this.recipientsRepository.findRepliesByOrganizationId({
        organizationId: orgId,
        campaignId: query.campaignId,
        replyCategory: query.replyCategory,
        search: query.search,
        page,
        limit,
      });

    return {
      items: items.map((row) => this.emailInboxMapper.toResponse(row)),
      total,
      page,
      limit,
    };
  }

  async markReplyAsDone(
    organizationId: string | null,
    recipientId: string,
    dto: MarkInboxReplyDoneDto,
  ): Promise<EmailInboxReplyResponse> {
    const orgId = requireOrganizationId(organizationId);
    const existing =
      await this.recipientsRepository.findReplyByIdAndOrganizationId(
        recipientId,
        orgId,
      );

    if (!existing) {
      throw new NotFoundException('Reply not found');
    }

    if (existing.recipient.replyReadAt) {
      throw new BadRequestException('Reply is already marked as done');
    }

    const updated = await this.recipientsRepository.markReplyAsRead(
      recipientId,
      orgId,
      {
        replyCategory: dto.replyCategory,
        reason: dto.reason,
      },
    );

    if (!updated) {
      throw new NotFoundException('Reply not found');
    }

    return this.emailInboxMapper.toResponse({
      recipient: updated,
      campaignName: existing.campaignName,
    });
  }
}
