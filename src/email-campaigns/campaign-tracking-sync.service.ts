import { Injectable, Logger } from '@nestjs/common';
import { BounceMonitorService } from './bounce-monitor/bounce-monitor.service';
import { ReplyMonitorService } from './reply-monitor/reply-monitor.service';

export interface SyncTrackingResult {
  repliesDetected: number;
  bouncesDetected: number;
  opensInferred: number;
  mailboxesPolled: number;
  skipped: boolean;
  started: boolean;
}

const EMPTY_SYNC_RESULT: SyncTrackingResult = {
  repliesDetected: 0,
  bouncesDetected: 0,
  opensInferred: 0,
  mailboxesPolled: 0,
  skipped: false,
  started: false,
};

@Injectable()
export class CampaignTrackingSyncService {
  private readonly logger = new Logger(CampaignTrackingSyncService.name);
  private isRunning = false;

  constructor(
    private readonly replyMonitorService: ReplyMonitorService,
    private readonly bounceMonitorService: BounceMonitorService,
  ) {}

  triggerSync(): SyncTrackingResult {
    if (this.isRunning) {
      return { ...EMPTY_SYNC_RESULT, skipped: true };
    }

    this.isRunning = true;

    void this.syncNow()
      .catch((error: unknown) => {
        this.logger.error(
          `Background tracking sync failed: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      })
      .finally(() => {
        this.isRunning = false;
      });

    return { ...EMPTY_SYNC_RESULT, started: true };
  }

  async syncTrackingManual(): Promise<SyncTrackingResult> {
    if (this.isRunning) {
      return { ...EMPTY_SYNC_RESULT, skipped: true };
    }

    this.isRunning = true;

    try {
      return await this.syncNow();
    } finally {
      this.isRunning = false;
    }
  }

  async syncNow(): Promise<SyncTrackingResult> {
    const [replyResult, bounceResult] = await Promise.all([
      this.replyMonitorService.syncNow(),
      this.bounceMonitorService.syncNow(),
    ]);

    const opensInferred =
      await this.replyMonitorService.backfillInferredOpens();

    return {
      repliesDetected: replyResult.repliesDetected,
      bouncesDetected: bounceResult.bouncesDetected,
      opensInferred,
      mailboxesPolled: Math.max(
        replyResult.mailboxesPolled,
        bounceResult.mailboxesPolled,
      ),
      skipped: replyResult.skipped && bounceResult.skipped,
      started: false,
    };
  }
}
