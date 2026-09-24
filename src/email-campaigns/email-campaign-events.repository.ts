import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EmailCampaignEventEntity,
  type EmailCampaignEventMetadata,
  type EmailCampaignEventType,
} from './entities/email-campaign-event.entity';

export interface CreateCampaignEventInput {
  campaignId: string;
  recipientId: string;
  messageId?: string | null;
  eventType: EmailCampaignEventType;
  occurredAt?: Date;
  metadata?: EmailCampaignEventMetadata;
}

export interface ListCampaignEventsFilters {
  campaignId: string;
  eventType?: EmailCampaignEventType;
  recipientId?: string;
  stepOrder?: number;
  search?: string;
  page: number;
  limit: number;
}

@Injectable()
export class EmailCampaignEventsRepository {
  constructor(
    @InjectRepository(EmailCampaignEventEntity)
    private readonly repository: Repository<EmailCampaignEventEntity>,
  ) {}

  create(input: CreateCampaignEventInput): EmailCampaignEventEntity {
    return this.repository.create({
      campaignId: input.campaignId,
      recipientId: input.recipientId,
      messageId: input.messageId ?? null,
      eventType: input.eventType,
      occurredAt: input.occurredAt ?? new Date(),
      metadata: input.metadata ?? {},
    });
  }

  save(entity: EmailCampaignEventEntity): Promise<EmailCampaignEventEntity> {
    return this.repository.save(entity);
  }

  count(): Promise<number> {
    return this.repository.count();
  }

  insert(input: CreateCampaignEventInput): Promise<EmailCampaignEventEntity> {
    return this.save(this.create(input));
  }

  countByMessageId(messageId: string): Promise<number> {
    return this.repository.count({ where: { messageId } });
  }

  countByRecipientId(recipientId: string): Promise<number> {
    return this.repository.count({ where: { recipientId } });
  }

  existsByMessageIdAndEventType(
    messageId: string,
    eventType: EmailCampaignEventType,
  ): Promise<boolean> {
    return this.repository
      .exists({
        where: { messageId, eventType },
      })
      .then(Boolean);
  }

  existsByRecipientIdAndEventType(
    recipientId: string,
    eventType: EmailCampaignEventType,
  ): Promise<boolean> {
    return this.repository
      .exists({
        where: { recipientId, eventType },
      })
      .then(Boolean);
  }

  async listByCampaign(
    filters: ListCampaignEventsFilters,
  ): Promise<{ items: EmailCampaignEventEntity[]; total: number }> {
    const qb = this.repository
      .createQueryBuilder('event')
      .innerJoinAndSelect('event.recipient', 'recipient')
      .leftJoinAndSelect('event.message', 'message')
      .where('event.campaignId = :campaignId', {
        campaignId: filters.campaignId,
      });

    if (filters.eventType) {
      qb.andWhere('event.eventType = :eventType', {
        eventType: filters.eventType,
      });
    }

    if (filters.recipientId) {
      qb.andWhere('event.recipientId = :recipientId', {
        recipientId: filters.recipientId,
      });
    }

    if (filters.stepOrder !== undefined) {
      qb.andWhere('message.stepOrder = :stepOrder', {
        stepOrder: filters.stepOrder,
      });
    }

    if (filters.search) {
      qb.andWhere('LOWER(recipient.email) LIKE LOWER(:search)', {
        search: `%${filters.search}%`,
      });
    }

    const total = await qb.getCount();

    const items = await qb
      .orderBy('event.occurredAt', 'DESC')
      .skip((filters.page - 1) * filters.limit)
      .take(filters.limit)
      .getMany();

    return { items, total };
  }

  async listByRecipient(
    campaignId: string,
    recipientId: string,
    page: number,
    limit: number,
  ): Promise<{ items: EmailCampaignEventEntity[]; total: number }> {
    const qb = this.repository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.message', 'message')
      .where('event.campaignId = :campaignId', { campaignId })
      .andWhere('event.recipientId = :recipientId', { recipientId });

    const total = await qb.getCount();

    const items = await qb
      .orderBy('event.occurredAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { items, total };
  }

  async hasRecentOpenFingerprint(
    messageId: string,
    userAgent?: string,
    ipAddress?: string,
    occurredAt = new Date(),
    windowMs = 5 * 60 * 1000,
  ): Promise<boolean> {
    const since = new Date(occurredAt.getTime() - windowMs);
    const qb = this.repository
      .createQueryBuilder('event')
      .where('event.messageId = :messageId', { messageId })
      .andWhere('event.eventType = :eventType', { eventType: 'open' })
      .andWhere('event.occurredAt >= :since', { since });

    if (userAgent) {
      qb.andWhere("event.metadata ->> 'userAgent' = :userAgent", { userAgent });
    }

    if (ipAddress) {
      qb.andWhere("event.metadata ->> 'ipAddress' = :ipAddress", { ipAddress });
    }

    return qb.getExists();
  }

  async wasBounceMatchedByFallback(messageId: string): Promise<boolean> {
    const event = await this.repository.findOne({
      where: { messageId, eventType: 'bounce' },
      order: { occurredAt: 'DESC' },
    });

    return event?.metadata?.correlationMethod === 'imap_fallback';
  }

  async aggregateDailyByCampaign(campaignId: string): Promise<
    Array<{
      date: string;
      sent: number;
      opened: number;
      clicked: number;
      replied: number;
      bounced: number;
      unsubscribed: number;
    }>
  > {
    const rows = await this.repository
      .createQueryBuilder('event')
      .select("TO_CHAR(event.occurredAt, 'YYYY-MM-DD')", 'date')
      .addSelect(
        "SUM(CASE WHEN event.eventType = 'sent' THEN 1 ELSE 0 END)",
        'sent',
      )
      .addSelect(
        "SUM(CASE WHEN event.eventType = 'open' AND COALESCE((event.metadata ->> 'isUnique')::boolean, true) THEN 1 ELSE 0 END)",
        'opened',
      )
      .addSelect(
        "SUM(CASE WHEN event.eventType = 'click' THEN 1 ELSE 0 END)",
        'clicked',
      )
      .addSelect(
        "SUM(CASE WHEN event.eventType = 'reply' THEN 1 ELSE 0 END)",
        'replied',
      )
      .addSelect(
        "SUM(CASE WHEN event.eventType IN ('bounce', 'send_failed') THEN 1 ELSE 0 END)",
        'bounced',
      )
      .addSelect(
        "SUM(CASE WHEN event.eventType = 'unsubscribe' THEN 1 ELSE 0 END)",
        'unsubscribed',
      )
      .where('event.campaignId = :campaignId', { campaignId })
      .groupBy("TO_CHAR(event.occurredAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany<{
        date: string;
        sent: string;
        opened: string;
        clicked: string;
        replied: string;
        bounced: string;
        unsubscribed: string;
      }>();

    return rows.map((row) => ({
      date: row.date,
      sent: Number(row.sent),
      opened: Number(row.opened),
      clicked: Number(row.clicked),
      replied: Number(row.replied),
      bounced: Number(row.bounced),
      unsubscribed: Number(row.unsubscribed),
    }));
  }
}
