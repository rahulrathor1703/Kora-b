import { fetchOutlookSentMessageId } from './mailbox-send-outlook.util';

describe('mailbox-send-outlook.util', () => {
  it('returns null when Graph list call fails', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false });
    const messageId = await fetchOutlookSentMessageId(
      'token',
      'prospect@example.com',
      'Hello',
      fetchMock as typeof fetch,
    );

    expect(messageId).toBeNull();
  });

  it('returns normalized internetMessageId for matching recipient', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          value: [
            {
              internetMessageId: '<abc@outlook.com>',
              toRecipients: [
                { emailAddress: { address: 'prospect@example.com' } },
              ],
            },
          ],
        }),
    });

    const messageId = await fetchOutlookSentMessageId(
      'token',
      'prospect@example.com',
      'Hello',
      fetchMock as typeof fetch,
    );

    expect(messageId).toBe('abc@outlook.com');
  });
});
