import {
  generateCampaignPublicIdFromFormat,
  validateCampaignIdFormat,
} from './generate-campaign-public-id.util';

describe('generateCampaignPublicIdFromFormat', () => {
  it('preserves format length and character classes for DD98392NHNA0', () => {
    const generated = generateCampaignPublicIdFromFormat('DD98392NHNA0');

    expect(generated).toHaveLength(12);
    expect(generated.slice(0, 2)).toMatch(/^[A-Z]{2}$/);
    expect(generated.slice(2, 7)).toMatch(/^\d{5}$/);
    expect(generated.slice(7, 11)).toMatch(/^[A-Z]{4}$/);
    expect(generated.slice(11)).toMatch(/^\d$/);
  });

  it('keeps literal separators', () => {
    const generated = generateCampaignPublicIdFromFormat('X-12');

    expect(generated).toMatch(/^[A-Z]-\d\d$/);
  });
});

describe('validateCampaignIdFormat', () => {
  it('accepts a template with placeholders', () => {
    expect(() => validateCampaignIdFormat('DD98392NHNA0')).not.toThrow();
  });

  it('rejects empty format', () => {
    expect(() => validateCampaignIdFormat('   ')).toThrow('Format is required');
  });

  it('rejects format without placeholders', () => {
    expect(() => validateCampaignIdFormat('--')).toThrow(
      'Format must include at least one letter or digit placeholder',
    );
  });
});
