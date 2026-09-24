import { appendSenderSignature, plainTextToHtml } from './email-body-html.util';

describe('appendSenderSignature', () => {
  it('appends a plain-text signature to html body', () => {
    const body = plainTextToHtml('Hello there');
    const result = appendSenderSignature(body, 'Best regards,\nAlex');

    expect(result).toContain('Hello there');
    expect(result).toContain('Best regards,');
    expect(result).toContain('Alex');
  });

  it('returns the original body when signature is empty', () => {
    const body = plainTextToHtml('Hello there');

    expect(appendSenderSignature(body, '')).toBe(body);
    expect(appendSenderSignature(body, null)).toBe(body);
  });
});
