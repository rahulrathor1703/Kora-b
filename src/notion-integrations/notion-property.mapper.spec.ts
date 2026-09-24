import {
  describeNotionProperty,
  flattenNotionPage,
  flattenNotionPropertyValue,
} from './notion-property.mapper';

describe('notion-property.mapper', () => {
  it('flattens title, email, select, and date properties', () => {
    expect(
      flattenNotionPropertyValue({
        id: 'title',
        type: 'title',
        title: [{ plain_text: 'Acme Brokers' }],
      }),
    ).toBe('Acme Brokers');

    expect(
      flattenNotionPropertyValue({
        id: 'email',
        type: 'email',
        email: 'jane@example.com',
      }),
    ).toBe('jane@example.com');

    expect(
      flattenNotionPropertyValue({
        id: 'industry',
        type: 'select',
        select: { name: 'Insurance' },
      }),
    ).toBe('Insurance');

    expect(
      flattenNotionPropertyValue({
        id: 'joined',
        type: 'date',
        date: { start: '2026-01-15' },
      }),
    ).toBe('2026-01-15');
  });

  it('marks relation and files as unsupported', () => {
    const relation = describeNotionProperty({
      id: 'rel',
      name: 'Related',
      type: 'relation',
    });
    const files = describeNotionProperty({
      id: 'files',
      name: 'Files',
      type: 'files',
    });

    expect(relation.supported).toBe(false);
    expect(relation.suggestedFieldType).toBeNull();
    expect(files.supported).toBe(false);
  });

  it('flattens a Notion page into CSV-like row values', () => {
    const row = flattenNotionPage({
      properties: {
        Name: {
          id: 'title',
          type: 'title',
          title: [{ plain_text: 'Jane Doe' }],
        },
        Email: {
          id: 'email',
          type: 'email',
          email: 'jane@example.com',
        },
        Related: {
          id: 'rel',
          type: 'relation',
          relation: [{ id: 'page-1' }],
        },
      },
    });

    expect(row).toEqual({
      Name: 'Jane Doe',
      Email: 'jane@example.com',
      Related: '',
    });
  });
});
