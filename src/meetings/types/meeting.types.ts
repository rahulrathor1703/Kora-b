export const MEETING_PLATFORMS = ['google', 'outlook', 'zoom'] as const;

export type MeetingPlatform = (typeof MEETING_PLATFORMS)[number];

export const MEETING_STATUSES = [
  'scheduled',
  'completed',
  'cancelled',
] as const;

export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const MEETING_LIST_STATUSES = [
  'all',
  'upcoming',
  'past',
  'cancelled',
  'completed',
] as const;

export type MeetingListStatus = (typeof MEETING_LIST_STATUSES)[number];
