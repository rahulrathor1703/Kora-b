import {
  Controller,
  Get,
  Header,
  Logger,
  NotFoundException,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CampaignTrackingService } from './campaign-tracking.service';
import {
  extractClickTrackingRequestContext,
  parseClickLinkIndex,
} from './campaign-tracking-request.util';
import { TRANSPARENT_GIF } from './campaign-tracking.util';

const UNSUBSCRIBE_CONFIRMATION_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Unsubscribed</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #0f172a; }
    .card { background: #fff; border-radius: 12px; padding: 32px; max-width: 420px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    h1 { font-size: 1.25rem; margin: 0 0 8px; }
    p { margin: 0; color: #64748b; font-size: 0.95rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>You have been unsubscribed</h1>
    <p>You will no longer receive emails from this campaign.</p>
  </div>
</body>
</html>`;

@Controller('track')
export class CampaignTrackingController {
  private readonly logger = new Logger(CampaignTrackingController.name);

  constructor(
    private readonly campaignTrackingService: CampaignTrackingService,
  ) {}

  @Get('open/:token')
  @Header('Content-Type', 'image/gif')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('Cross-Origin-Resource-Policy', 'cross-origin')
  async trackOpen(
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const requestContext = extractClickTrackingRequestContext(req);

    try {
      await this.campaignTrackingService.recordOpen(token, {
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
      });
    } catch (error) {
      // Return pixel even when token is invalid to avoid leaking existence.
      this.logger.warn(
        `Open tracking failed for token ${token}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }

    res.status(200).send(TRANSPARENT_GIF);
  }

  @Get('click/:token')
  async trackClick(
    @Param('token') token: string,
    @Query('l') linkIndexQuery: string | undefined,
    @Query('sig') sig: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const linkIndex = parseClickLinkIndex(linkIndexQuery);
    const requestContext = extractClickTrackingRequestContext(req);

    if (linkIndex === undefined) {
      throw new NotFoundException('Redirect URL is required');
    }

    const redirectUrl = await this.campaignTrackingService.resolveClickRedirect(
      token,
      {
        linkIndex,
        sig,
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
      },
    );

    res.redirect(302, redirectUrl);
  }

  @Get('unsubscribe/:token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async trackUnsubscribe(@Param('token') token: string, @Res() res: Response) {
    try {
      await this.campaignTrackingService.recordUnsubscribe(token);
    } catch (error) {
      this.logger.warn(
        `Unsubscribe tracking failed for token ${token}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      throw new NotFoundException('Unsubscribe link not found');
    }

    res.status(200).send(UNSUBSCRIBE_CONFIRMATION_HTML);
  }
}
