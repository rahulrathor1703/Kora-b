import {
  signClickLink,
  verifyClickLink,
} from './campaign-tracking-signature.util';

describe('campaign-tracking-signature.util', () => {
  const secret = 'test-tracking-secret';
  const token = '00000000-0000-0000-0000-000000000099';

  it('signs and verifies click links', () => {
    const signature = signClickLink(secret, token, 2);

    expect(verifyClickLink(secret, token, 2, signature)).toBe(true);
  });

  it('rejects tampered signatures', () => {
    const signature = signClickLink(secret, token, 2);

    expect(verifyClickLink(secret, token, 3, signature)).toBe(false);
    expect(verifyClickLink(secret, token, 2, `${signature}x`)).toBe(false);
    expect(verifyClickLink('other-secret', token, 2, signature)).toBe(false);
  });
});
