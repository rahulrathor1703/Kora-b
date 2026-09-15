export const GMAIL_SMTP_PRESET = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
} as const;

export const GMAIL_SMTP_ATTEMPTS: ReadonlyArray<{
  host: string;
  port: number;
  secure: boolean;
  requireTls?: boolean;
}> = [
  {
    host: GMAIL_SMTP_PRESET.host,
    port: 587,
    secure: false,
    requireTls: true,
  },
  {
    host: GMAIL_SMTP_PRESET.host,
    port: 465,
    secure: true,
    requireTls: false,
  },
];

export const OUTLOOK_PERSONAL_SMTP_PRESET = {
  host: 'smtp-mail.outlook.com',
  port: 587,
  secure: false,
} as const;

export const OUTLOOK_M365_SMTP_PRESET = {
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
} as const;

const OUTLOOK_CONSUMER_DOMAINS = new Set([
  'outlook.com',
  'hotmail.com',
  'live.com',
]);

export function getOutlookSmtpHosts(email: string): string[] {
  const domain = email.split('@')[1]?.toLowerCase();

  if (domain && OUTLOOK_CONSUMER_DOMAINS.has(domain)) {
    return [OUTLOOK_PERSONAL_SMTP_PRESET.host];
  }

  return [OUTLOOK_M365_SMTP_PRESET.host, OUTLOOK_PERSONAL_SMTP_PRESET.host];
}
