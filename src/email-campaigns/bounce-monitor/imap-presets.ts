export const GMAIL_IMAP_PRESET = {
  host: 'imap.gmail.com',
  port: 993,
  secure: true,
} as const;

export const OUTLOOK_IMAP_PRESET = {
  host: 'outlook.office365.com',
  port: 993,
  secure: true,
} as const;

export interface ImapConnectionPreset {
  host: string;
  port: number;
  secure: boolean;
}

export function resolveImapPreset(
  provider: string,
  smtpHost: string | null,
): ImapConnectionPreset | null {
  if (provider === 'gmail') {
    return GMAIL_IMAP_PRESET;
  }

  if (provider === 'outlook') {
    return OUTLOOK_IMAP_PRESET;
  }

  if (provider === 'smtp' && smtpHost) {
    if (smtpHost.includes('gmail.com')) {
      return GMAIL_IMAP_PRESET;
    }

    if (
      smtpHost.includes('office365.com') ||
      smtpHost.includes('outlook.com')
    ) {
      return OUTLOOK_IMAP_PRESET;
    }

    const imapHost = smtpHost.replace(/^smtp\./i, 'imap.');
    return {
      host: imapHost,
      port: 993,
      secure: true,
    };
  }

  return null;
}

export function getReplyMonitorMailboxes(
  provider: string,
  preset: ImapConnectionPreset,
): string[] {
  if (provider === 'gmail' || preset.host === GMAIL_IMAP_PRESET.host) {
    return ['INBOX', '[Gmail]/All Mail'];
  }

  return ['INBOX'];
}
