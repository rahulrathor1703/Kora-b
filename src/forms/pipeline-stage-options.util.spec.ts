import {
  buildMinimalPipelineStageOverlay,
  mergePipelineStageOptions,
  pipelineStageOverlayIsEmpty,
} from './pipeline-stage-options.util';

const platform = [
  { value: 'new', label: 'New', color: '#64748b' },
  { value: 'contacted', label: 'Contacted', color: '#3b82f6' },
];

describe('mergePipelineStageOptions', () => {
  it('returns platform options tagged as platform when no overlay', () => {
    expect(mergePipelineStageOptions(platform, undefined)).toEqual([
      { value: 'new', label: 'New', color: '#64748b', source: 'platform' },
      {
        value: 'contacted',
        label: 'Contacted',
        color: '#3b82f6',
        source: 'platform',
      },
    ]);
  });

  it('applies org color override on platform stage and appends org stages', () => {
    const overlay = [
      { value: 'contacted', label: 'Contacted', color: '#f59e0b' },
      { value: 'eqweq', label: 'Custom', color: '#ec4899' },
    ];

    expect(mergePipelineStageOptions(platform, overlay)).toEqual([
      { value: 'new', label: 'New', color: '#64748b', source: 'platform' },
      {
        value: 'contacted',
        label: 'Contacted',
        color: '#f59e0b',
        source: 'platform',
      },
      {
        value: 'eqweq',
        label: 'Custom',
        color: '#ec4899',
        source: 'org',
      },
    ]);
  });

  it('uses platform colors when legacy overlay omits colors on platform values', () => {
    const overlay = [
      { value: 'new', label: 'New' },
      { value: 'contacted', label: 'Contacted', color: '#f59e0b' },
    ];

    expect(mergePipelineStageOptions(platform, overlay)[0]?.color).toBe(
      '#64748b',
    );
  });
});

describe('buildMinimalPipelineStageOverlay', () => {
  it('returns empty when submitted matches platform', () => {
    expect(buildMinimalPipelineStageOverlay(platform, platform)).toEqual([]);
    expect(pipelineStageOverlayIsEmpty(platform, platform)).toBe(true);
  });

  it('stores only diffs and org-added stages', () => {
    const submitted = [
      { value: 'new', label: 'New', color: '#64748b' },
      { value: 'contacted', label: 'Contacted', color: '#f59e0b' },
      { value: 'eqweq', label: 'Custom', color: '#ec4899' },
    ];

    expect(buildMinimalPipelineStageOverlay(submitted, platform)).toEqual([
      { value: 'contacted', label: 'Contacted', color: '#f59e0b' },
      { value: 'eqweq', label: 'Custom', color: '#ec4899' },
    ]);
  });
});
