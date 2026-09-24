import { createHmac, timingSafeEqual } from 'crypto';

function buildClickLinkPayload(token: string, linkIndex: number): string {
  return `${token}:${linkIndex}`;
}

export function signClickLink(
  secret: string,
  token: string,
  linkIndex: number,
): string {
  return createHmac('sha256', secret)
    .update(buildClickLinkPayload(token, linkIndex))
    .digest('base64url');
}

export function verifyClickLink(
  secret: string,
  token: string,
  linkIndex: number,
  signature: string,
): boolean {
  const expected = signClickLink(secret, token, linkIndex);

  try {
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(signature);

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
}
