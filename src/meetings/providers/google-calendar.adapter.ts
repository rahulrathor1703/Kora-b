import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import type {
  ProviderMeetingAdapter,
  ProviderMeetingInput,
  ProviderMeetingResult,
} from './provider-meeting.types';

@Injectable()
export class GoogleCalendarAdapter implements ProviderMeetingAdapter {
  async createMeeting(
    accessToken: string,
    input: ProviderMeetingInput,
  ): Promise<ProviderMeetingResult> {
    const body = {
      summary: input.title,
      description: this.buildDescription(input),
      start: {
        dateTime: input.startAt.toISOString(),
        timeZone: input.timeZone,
      },
      end: {
        dateTime: input.endAt.toISOString(),
        timeZone: input.timeZone,
      },
      attendees: [
        {
          email: input.attendeeEmail,
          displayName: input.attendeeName,
        },
      ],
      conferenceData: {
        createRequest: {
          requestId: `markos-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };

    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      throw new BadRequestException('Failed to create Google Calendar event');
    }

    const event = (await response.json()) as {
      id?: string;
      hangoutLink?: string;
      conferenceData?: {
        entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
      };
    };

    if (!event.id) {
      throw new InternalServerErrorException(
        'Google Calendar event was created without an id',
      );
    }

    const meetingUrl =
      event.hangoutLink ??
      event.conferenceData?.entryPoints?.find(
        (entry) => entry.entryPointType === 'video',
      )?.uri ??
      null;

    return {
      externalEventId: event.id,
      meetingUrl,
    };
  }

  async deleteMeeting(
    accessToken: string,
    externalEventId: string,
  ): Promise<void> {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(externalEventId)}?sendUpdates=all`,
      {
        method: 'DELETE',
        headers: { authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok && response.status !== 404) {
      throw new BadRequestException('Failed to delete Google Calendar event');
    }
  }

  private buildDescription(input: ProviderMeetingInput): string | undefined {
    const parts = [input.description?.trim(), input.agenda?.trim()].filter(
      (part): part is string => Boolean(part),
    );

    return parts.length > 0 ? parts.join('\n\n') : undefined;
  }
}
