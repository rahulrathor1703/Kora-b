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
export class OutlookCalendarAdapter implements ProviderMeetingAdapter {
  async createMeeting(
    accessToken: string,
    input: ProviderMeetingInput,
  ): Promise<ProviderMeetingResult> {
    const body = {
      subject: input.title,
      body: {
        contentType: 'Text',
        content: this.buildDescription(input) ?? '',
      },
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
          emailAddress: {
            address: input.attendeeEmail,
            name: input.attendeeName,
          },
          type: 'required',
        },
      ],
    };

    const response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to create Outlook calendar event');
    }

    const event = (await response.json()) as {
      id?: string;
      onlineMeeting?: { joinUrl?: string };
      webLink?: string;
    };

    if (!event.id) {
      throw new InternalServerErrorException(
        'Outlook event was created without an id',
      );
    }

    return {
      externalEventId: event.id,
      meetingUrl: event.onlineMeeting?.joinUrl ?? event.webLink ?? null,
    };
  }

  async deleteMeeting(
    accessToken: string,
    externalEventId: string,
  ): Promise<void> {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(externalEventId)}`,
      {
        method: 'DELETE',
        headers: { authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok && response.status !== 404) {
      throw new BadRequestException('Failed to delete Outlook calendar event');
    }
  }

  private buildDescription(input: ProviderMeetingInput): string | undefined {
    const parts = [input.description?.trim(), input.agenda?.trim()].filter(
      (part): part is string => Boolean(part),
    );

    return parts.length > 0 ? parts.join('\n\n') : undefined;
  }
}
