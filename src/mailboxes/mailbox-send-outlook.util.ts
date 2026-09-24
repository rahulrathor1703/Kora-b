import { normalizeMessageId } from '../email-campaigns/bounce-monitor/bounce-parser.util';

export async function fetchOutlookSentMessageId(
  accessToken: string,
  recipientEmail: string,
  subject: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const since = new Date(Date.now() - 60_000).toISOString();
  const escapedSubject = subject.replace(/'/g, "''");
  const filter = encodeURIComponent(
    `sentDateTime ge ${since} and subject eq '${escapedSubject}'`,
  );
  const url =
    `https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages` +
    `?$top=5&$orderby=sentDateTime desc&$select=internetMessageId,toRecipients,subject,sentDateTime&$filter=${filter}`;

  const response = await fetchImpl(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const body = (await response.json()) as {
    value?: Array<{
      internetMessageId?: string | null;
      toRecipients?: Array<{ emailAddress?: { address?: string } }>;
    }>;
  };

  const normalizedRecipient = recipientEmail.trim().toLowerCase();

  for (const message of body.value ?? []) {
    const matchesRecipient = (message.toRecipients ?? []).some(
      (recipient) =>
        recipient.emailAddress?.address?.trim().toLowerCase() ===
        normalizedRecipient,
    );

    if (!matchesRecipient || !message.internetMessageId) {
      continue;
    }

    return normalizeMessageId(message.internetMessageId);
  }

  return null;
}
