import {
  extractSenderEmail,
  getReplyCandidateMessageIds,
  isReplyCandidate,
  parseReplyEmail,
} from './reply-parser.util';

describe('reply-parser.util', () => {
  it('extracts In-Reply-To and References message IDs', () => {
    const parsed = parseReplyEmail({
      from: 'prospect@example.com',
      subject: 'Re: Your outreach',
      text: [
        'From: Prospect <prospect@example.com>',
        'In-Reply-To: <abc123@mail.gmail.com>',
        'References: <thread-root@mail.gmail.com> <abc123@mail.gmail.com>',
      ].join('\n'),
    });

    expect(parsed.inReplyToMessageIds).toContain('abc123@mail.gmail.com');
    expect(parsed.referenceMessageIds).toContain('thread-root@mail.gmail.com');
    expect(getReplyCandidateMessageIds(parsed)).toEqual(
      expect.arrayContaining([
        'abc123@mail.gmail.com',
        'thread-root@mail.gmail.com',
      ]),
    );
  });

  it('extracts sender email from display name header', () => {
    expect(extractSenderEmail('Jane Doe <jane@client.com>')).toBe(
      'jane@client.com',
    );
    expect(extractSenderEmail('plain@client.com')).toBe('plain@client.com');
  });

  it('excludes bounce senders from reply candidates', () => {
    expect(
      isReplyCandidate('mailer-daemon@googlemail.com', 'Delivery failure', {
        inReplyToMessageIds: [],
        referenceMessageIds: [],
        text: '',
      }),
    ).toBe(false);
    expect(
      isReplyCandidate('prospect@example.com', 'Re: Hello', {
        inReplyToMessageIds: [],
        referenceMessageIds: [],
        text: '',
      }),
    ).toBe(true);
  });

  it('accepts emails from known campaign recipients even without reply headers', () => {
    expect(
      isReplyCandidate(
        'prospect@example.com',
        'Thanks',
        {
          inReplyToMessageIds: [],
          referenceMessageIds: [],
          text: '',
        },
        new Set(['prospect@example.com']),
      ),
    ).toBe(true);
  });

  it('rejects unrelated senders when a known recipient list is provided', () => {
    expect(
      isReplyCandidate(
        'other@example.com',
        'Re: Hello',
        {
          inReplyToMessageIds: [],
          referenceMessageIds: [],
          text: '',
        },
        new Set(['prospect@example.com']),
      ),
    ).toBe(false);
  });

  it('accepts replies with correlation headers even when From was rewritten', () => {
    expect(
      isReplyCandidate(
        'other@example.com',
        'Re: Hello',
        {
          inReplyToMessageIds: ['abc123@mail.gmail.com'],
          referenceMessageIds: [],
          text: 'In-Reply-To: <abc123@mail.gmail.com>',
        },
        new Set(['prospect@example.com']),
      ),
    ).toBe(true);
  });

  it('extracts sender email from plain addresses with trailing text', () => {
    expect(extractSenderEmail('sanjay.kumar@evervent.in via evervent.in')).toBe(
      'sanjay.kumar@evervent.in',
    );
  });
});
