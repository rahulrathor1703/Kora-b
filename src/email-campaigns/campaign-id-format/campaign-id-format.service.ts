import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { requireOrganizationId } from '../../common/organization/require-organization-id';
import { EmailCampaignsRepository } from '../email-campaigns.repository';
import { CampaignIdFormatRepository } from './campaign-id-format.repository';
import type {
  CampaignIdFormatResponse,
  SetCampaignIdFormatDto,
} from './dto/campaign-id-format.dto';
import {
  generateCampaignPublicIdFromFormat,
  validateCampaignIdFormat,
} from './generate-campaign-public-id.util';

const MAX_GENERATION_ATTEMPTS = 25;

@Injectable()
export class CampaignIdFormatService {
  constructor(
    private readonly campaignIdFormatRepository: CampaignIdFormatRepository,
    private readonly emailCampaignsRepository: EmailCampaignsRepository,
  ) {}

  async getFormat(
    organizationId: string | null,
  ): Promise<CampaignIdFormatResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const settings = await this.campaignIdFormatRepository.findByOrganizationId(
      resolvedOrganizationId,
    );

    if (!settings) {
      return {
        format: null,
        configured: false,
        locked: false,
        updatedAt: null,
      };
    }

    return {
      format: settings.format,
      configured: true,
      locked: true,
      updatedAt: settings.updatedAt.toISOString(),
    };
  }

  async setFormat(
    dto: SetCampaignIdFormatDto,
    organizationId: string | null,
  ): Promise<CampaignIdFormatResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const format = dto.format.trim();

    try {
      validateCampaignIdFormat(format);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Invalid campaign ID format';
      throw new BadRequestException(message);
    }

    const existing = await this.campaignIdFormatRepository.findByOrganizationId(
      resolvedOrganizationId,
    );

    if (existing) {
      throw new ConflictException(
        'Campaign ID format is already configured and cannot be changed',
      );
    }

    const entity = this.campaignIdFormatRepository.create(
      resolvedOrganizationId,
      format,
    );
    const saved = await this.campaignIdFormatRepository.save(entity);

    return {
      format: saved.format,
      configured: true,
      locked: true,
      updatedAt: saved.updatedAt.toISOString(),
    };
  }

  async generateUniqueCampaignPublicId(
    organizationId: string,
  ): Promise<string> {
    const settings =
      await this.campaignIdFormatRepository.findByOrganizationId(
        organizationId,
      );

    if (!settings) {
      throw new BadRequestException(
        'Configure the campaign ID format in Email settings before creating a campaign',
      );
    }

    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
      const candidate = generateCampaignPublicIdFromFormat(settings.format);
      const taken =
        await this.emailCampaignsRepository.existsByOrganizationAndPublicId(
          organizationId,
          candidate,
        );

      if (!taken) {
        return candidate;
      }
    }

    throw new BadRequestException(
      'Unable to generate a unique campaign ID. Try a longer format.',
    );
  }
}
