export function slugifySectionKey(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  if (!slug) {
    return 'section';
  }

  return slug.startsWith('section_') ? slug : `section_${slug}`;
}

export function isSectionFieldType(type: string): boolean {
  return type === 'section';
}
