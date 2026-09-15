import { BadRequestException, Injectable } from '@nestjs/common';
import { CalendarConnectionsOAuthService } from '../calendar-connections/calendar-connections-oauth.service';
import type { MeetingPlatform } from './types/meeting.types';
import { GoogleCalendarAdapter } from './providers/google-calendar.adapter';
import { OutlookCalendarAdapter } from './providers/outlook-calendar.adapter';
import type {
  ProviderMeetingAdapter,
  ProviderMeetingInput,
  ProviderMeetingResult,
} from './providers/provider-meeting.types';
import { ZoomMeetingAdapter } from './providers/zoom-meeting.adapter';

@Injectable()
export class MeetingCalendarSyncService {
  constructor(
    private readonly calendarConnectionsOAuthService: CalendarConnectionsOAuthService,
    private readonly googleCalendarAdapter: GoogleCalendarAdapter,
    private readonly outlookCalendarAdapter: OutlookCalendarAdapter,
    private readonly zoomMeetingAdapter: ZoomMeetingAdapter,
  ) {}

  async createProviderMeeting(
    userId: string,
    platform: MeetingPlatform,
    input: ProviderMeetingInput,
  ): Promise<ProviderMeetingResult> {
    const { accessToken } =
      await this.calendarConnectionsOAuthService.getValidAccessToken(
        userId,
        platform,
      );

    return this.getAdapter(platform).createMeeting(accessToken, input);
  }

  async deleteProviderMeeting(
    userId: string,
    platform: MeetingPlatform,
    externalEventId: string,
  ): Promise<void> {
    const { accessToken } =
      await this.calendarConnectionsOAuthService.getValidAccessToken(
        userId,
        platform,
      );

    await this.getAdapter(platform).deleteMeeting(accessToken, externalEventId);
  }

  private getAdapter(platform: MeetingPlatform): ProviderMeetingAdapter {
    switch (platform) {
      case 'google':
        return this.googleCalendarAdapter;
      case 'outlook':
        return this.outlookCalendarAdapter;
      case 'zoom':
        return this.zoomMeetingAdapter;
      default: {
        const exhaustiveCheck: never = platform;
        throw new BadRequestException(
          `Unsupported meeting platform: ${String(exhaustiveCheck)}`,
        );
      }
    }
  }
}
