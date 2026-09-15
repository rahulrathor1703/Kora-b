export interface ProviderMeetingInput {
  title: string;
  description?: string | null;
  agenda?: string | null;
  startAt: Date;
  endAt: Date;
  attendeeEmail: string;
  attendeeName: string;
  timeZone: string;
}

export interface ProviderMeetingResult {
  externalEventId: string;
  meetingUrl: string | null;
}

export interface ProviderMeetingAdapter {
  createMeeting(
    accessToken: string,
    input: ProviderMeetingInput,
  ): Promise<ProviderMeetingResult>;

  deleteMeeting(accessToken: string, externalEventId: string): Promise<void>;
}
