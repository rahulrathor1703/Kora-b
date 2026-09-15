import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { EmailCampaignsRepository } from '../email-campaigns/email-campaigns.repository';
import { EmailTemplatesRepository } from '../email-templates/email-templates.repository';
import { EmailAttachmentsRepository } from './email-attachments.repository';
import { EmailStepAttachmentEntity } from './entities/email-step-attachment.entity';
import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENTS_PER_STEP,
  MAX_ATTACHMENT_SIZE_BYTES,
  type EmailStepAttachmentResponse,
} from './email-attachment.types';

@Injectable()
export class EmailAttachmentsService {
  constructor(
    private readonly attachmentsRepository: EmailAttachmentsRepository,
    private readonly emailCampaignsRepository: EmailCampaignsRepository,
    private readonly emailTemplatesRepository: EmailTemplatesRepository,
    private readonly configService: ConfigService,
  ) {}

  async listCampaignStepAttachments(
    organizationId: string,
    campaignId: string,
    stepOrder: number,
  ): Promise<EmailStepAttachmentResponse[]> {
    const step = await this.getCampaignStep(
      organizationId,
      campaignId,
      stepOrder,
    );
    const attachments = await this.attachmentsRepository.findByCampaignStepId(
      step.id,
    );
    return attachments.map((attachment) => this.toResponse(attachment));
  }

  async uploadCampaignStepAttachment(
    organizationId: string,
    campaignId: string,
    stepOrder: number,
    file: Express.Multer.File,
  ): Promise<EmailStepAttachmentResponse> {
    this.validateFile(file);
    const step = await this.getCampaignStep(
      organizationId,
      campaignId,
      stepOrder,
    );
    await this.ensureCapacity(step.id, 'campaign');

    const entity = await this.persistFile(organizationId, file, {
      campaignStepId: step.id,
      templateStepId: null,
    });

    return this.toResponse(entity);
  }

  async listTemplateStepAttachments(
    organizationId: string,
    templateId: string,
    stepOrder: number,
  ): Promise<EmailStepAttachmentResponse[]> {
    const step = await this.getTemplateStep(
      organizationId,
      templateId,
      stepOrder,
    );
    const attachments = await this.attachmentsRepository.findByTemplateStepId(
      step.id,
    );
    return attachments.map((attachment) => this.toResponse(attachment));
  }

  async uploadTemplateStepAttachment(
    organizationId: string,
    templateId: string,
    stepOrder: number,
    file: Express.Multer.File,
  ): Promise<EmailStepAttachmentResponse> {
    this.validateFile(file);
    const step = await this.getTemplateStep(
      organizationId,
      templateId,
      stepOrder,
    );
    await this.ensureCapacity(step.id, 'template');

    const entity = await this.persistFile(organizationId, file, {
      campaignStepId: null,
      templateStepId: step.id,
    });

    return this.toResponse(entity);
  }

  async deleteAttachment(
    organizationId: string,
    attachmentId: string,
  ): Promise<void> {
    const attachment =
      await this.attachmentsRepository.findByIdAndOrganizationId(
        attachmentId,
        organizationId,
      );

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    await this.deleteStoredFile(attachment.storagePath);
    await this.attachmentsRepository.remove(attachment);
  }

  async copyTemplateAttachmentsToCampaignStepByOrder(
    organizationId: string,
    campaignId: string,
    stepOrder: number,
    templateStepId: string,
  ): Promise<EmailStepAttachmentResponse[]> {
    const campaignStep = await this.getCampaignStep(
      organizationId,
      campaignId,
      stepOrder,
    );

    await this.copyTemplateStepAttachmentsToCampaignStep(
      organizationId,
      templateStepId,
      campaignStep.id,
    );

    return this.listCampaignStepAttachments(
      organizationId,
      campaignId,
      stepOrder,
    );
  }

  async copyTemplateStepAttachmentsToCampaignStep(
    organizationId: string,
    templateStepId: string,
    campaignStepId: string,
  ): Promise<void> {
    const sourceAttachments =
      await this.attachmentsRepository.findByTemplateStepId(templateStepId);

    for (const source of sourceAttachments) {
      const currentCount =
        await this.attachmentsRepository.countByCampaignStepId(campaignStepId);

      if (currentCount >= MAX_ATTACHMENTS_PER_STEP) {
        break;
      }

      const buffer = await readFile(source.storagePath);
      const copiedEntity = new EmailStepAttachmentEntity();
      copiedEntity.organizationId = organizationId;
      copiedEntity.campaignStepId = campaignStepId;
      copiedEntity.templateStepId = null;
      copiedEntity.originalFilename = source.originalFilename;
      copiedEntity.mimeType = source.mimeType;
      copiedEntity.sizeBytes = source.sizeBytes;
      copiedEntity.storedFilename = `${randomUUID()}-${source.storedFilename}`;
      copiedEntity.storagePath = this.buildStoragePath(
        organizationId,
        copiedEntity.storedFilename,
      );

      await mkdir(path.dirname(copiedEntity.storagePath), { recursive: true });
      await writeFile(copiedEntity.storagePath, buffer);
      await this.attachmentsRepository.save(copiedEntity);
    }
  }

  async loadCampaignStepAttachmentBuffers(
    campaignStepId: string,
  ): Promise<
    Array<{ filename: string; content: Buffer; contentType: string }>
  > {
    const attachments =
      await this.attachmentsRepository.findByCampaignStepId(campaignStepId);

    return Promise.all(
      attachments.map(async (attachment) => ({
        filename: attachment.originalFilename,
        content: await readFile(attachment.storagePath),
        contentType: attachment.mimeType,
      })),
    );
  }

  private async getCampaignStep(
    organizationId: string,
    campaignId: string,
    stepOrder: number,
  ) {
    const campaign =
      await this.emailCampaignsRepository.findByIdAndOrganizationId(
        campaignId,
        organizationId,
      );

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const step = campaign.steps?.find((item) => item.stepOrder === stepOrder);

    if (!step) {
      throw new NotFoundException('Campaign step not found');
    }

    return step;
  }

  private async getTemplateStep(
    organizationId: string,
    templateId: string,
    stepOrder: number,
  ) {
    const template =
      await this.emailTemplatesRepository.findByIdAndOrganizationId(
        templateId,
        organizationId,
      );

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const step = template.steps?.find((item) => item.stepOrder === stepOrder);

    if (!step) {
      throw new NotFoundException('Template step not found');
    }

    return step;
  }

  private async ensureCapacity(stepId: string, owner: 'campaign' | 'template') {
    const count =
      owner === 'campaign'
        ? await this.attachmentsRepository.countByCampaignStepId(stepId)
        : await this.attachmentsRepository.countByTemplateStepId(stepId);

    if (count >= MAX_ATTACHMENTS_PER_STEP) {
      throw new BadRequestException(
        `Each email step can have at most ${MAX_ATTACHMENTS_PER_STEP} attachments`,
      );
    }
  }

  private validateFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('A file upload is required');
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new BadRequestException('Attachment exceeds the 5 MB size limit');
    }

    const extension = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(extension)) {
      throw new BadRequestException('File type is not allowed');
    }

    if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('File type is not allowed');
    }
  }

  private async persistFile(
    organizationId: string,
    file: Express.Multer.File,
    owner: { campaignStepId: string | null; templateStepId: string | null },
  ): Promise<EmailStepAttachmentEntity> {
    const storedFilename = `${randomUUID()}-${path.basename(file.originalname)}`;
    const storagePath = this.buildStoragePath(organizationId, storedFilename);

    await mkdir(path.dirname(storagePath), { recursive: true });
    await writeFile(storagePath, file.buffer);

    const entity = new EmailStepAttachmentEntity();
    entity.organizationId = organizationId;
    entity.campaignStepId = owner.campaignStepId;
    entity.templateStepId = owner.templateStepId;
    entity.originalFilename = file.originalname;
    entity.storedFilename = storedFilename;
    entity.mimeType = file.mimetype;
    entity.sizeBytes = file.size;
    entity.storagePath = storagePath;

    return this.attachmentsRepository.save(entity);
  }

  private buildStoragePath(
    organizationId: string,
    storedFilename: string,
  ): string {
    const baseDir =
      this.configService.get<string>('emailAttachmentsDir') ??
      path.join(process.cwd(), 'uploads', 'email-attachments');

    return path.join(baseDir, organizationId, storedFilename);
  }

  private async deleteStoredFile(storagePath: string) {
    try {
      await unlink(storagePath);
    } catch {
      // ignore missing files
    }
  }

  private toResponse(
    entity: EmailStepAttachmentEntity,
  ): EmailStepAttachmentResponse {
    return {
      id: entity.id,
      originalFilename: entity.originalFilename,
      mimeType: entity.mimeType,
      sizeBytes: entity.sizeBytes,
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
