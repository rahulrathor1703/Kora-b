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
export class ZoomMeetingAdapter implements ProviderMeetingAdapter {
  async createMeeting(
    accessToken: string,
    input: ProviderMeetingInput,
  ): Promise<ProviderMeetingResult> {
    const durationMinutes = Math.max(
      15,
      Math.round((input.endAt.getTime() - input.startAt.getTime()) / 60_000),
    );

    const body = {
      topic: input.title,
      type: 2,
      start_time: input.startAt.toISOString(),
      duration: durationMinutes,
      timezone: input.timeZone,
      agenda: this.buildDescription(input),
      settings: {
        host_video: true,
        participant_video: true,
        approval_type: 2,
        registration_type: 1,
        registrants_email_notification: true,
      },
    };

    const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to create Zoom meeting');
    }

    const meeting = (await response.json()) as {
      id?: number;
      join_url?: string;
    };

    if (!meeting.id) {
      throw new InternalServerErrorException(
        'Zoom meeting was created without an id',
      );
    }

    if (input.attendeeEmail) {
      await this.addRegistrant(
        accessToken,
        String(meeting.id),
        input.attendeeEmail,
        input.attendeeName,
      );
    }

    return {
      externalEventId: String(meeting.id),
      meetingUrl: meeting.join_url ?? null,
    };
  }

  async deleteMeeting(
    accessToken: string,
    externalEventId: string,
  ): Promise<void> {
    const response = await fetch(
      `https://api.zoom.us/v2/meetings/${encodeURIComponent(externalEventId)}`,
      {
        method: 'DELETE',
        headers: { authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok && response.status !== 404) {
      throw new BadRequestException('Failed to delete Zoom meeting');
    }
  }

  private async addRegistrant(
    accessToken: string,
    meetingId: string,
    email: string,
    name: string,
  ): Promise<void> {
    const [firstName, ...rest] = name.trim().split(/\s+/);
    const lastName = rest.join(' ') || firstName;

    const response = await fetch(
      `https://api.zoom.us/v2/meetings/${encodeURIComponent(meetingId)}/registrants`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email,
          first_name: firstName,
          last_name: lastName,
        }),
      },
    );

    if (!response.ok) {
      throw new BadRequestException(
        'Zoom meeting created but invite email could not be sent',
      );
    }
  }

  private buildDescription(input: ProviderMeetingInput): string | undefined {
    const parts = [input.description?.trim(), input.agenda?.trim()].filter(
      (part): part is string => Boolean(part),
    );

    return parts.length > 0 ? parts.join('\n\n') : undefined;
  }
}
