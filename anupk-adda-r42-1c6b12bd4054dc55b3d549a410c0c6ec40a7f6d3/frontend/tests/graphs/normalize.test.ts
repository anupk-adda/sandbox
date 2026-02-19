import { describe, expect, it } from 'vitest';
import { normalizeRelative } from '../../src/components/graphs/v2/normalize';

describe('normalizeRelative', () => {
  it('inverts pace so faster values are higher', () => {
    const result = normalizeRelative([4, 5, 6], 'min/km');
    expect(result.values.map((value) => Math.round(value))).toEqual([100, 50, 0]);
  });

  it('handles flat data by centering at 50', () => {
    const result = normalizeRelative([7, 7, 7], 'bpm');
    expect(result.values).toEqual([50, 50, 50]);
    expect(result.isFlat).toBe(true);
  });
});
