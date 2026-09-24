const HTML_TAG_PATTERN = /<[a-z][\s\S]*>/i;

export function isHtmlEmailBody(body: string): boolean {
  return HTML_TAG_PATTERN.test(body);
}

export function plainTextToHtml(body: string): string {
  const trimmed = body.trim();

  if (!trimmed) {
    return '';
  }

  if (isHtmlEmailBody(trimmed)) {
    return trimmed;
  }

  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => {
      const withBreaks = paragraph
        .split('\n')
        .map((line) => line.trim())
        .join('<br>');
      return `<p>${withBreaks}</p>`;
    })
    .join('');
}

export function normalizeEmailBodyHtml(body: string): string {
  return plainTextToHtml(body);
}

export function appendSenderSignature(
  htmlBody: string,
  signature: string | null | undefined,
): string {
  const trimmedSignature = signature?.trim();

  if (!trimmedSignature) {
    return htmlBody;
  }

  const signatureHtml = plainTextToHtml(trimmedSignature);

  if (!signatureHtml) {
    return htmlBody;
  }

  return `${htmlBody}<br><br>${signatureHtml}`;
}

export function getPlainTextFromHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
