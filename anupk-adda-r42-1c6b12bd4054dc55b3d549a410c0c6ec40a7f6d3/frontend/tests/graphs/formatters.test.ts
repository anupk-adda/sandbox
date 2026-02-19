import { describe, expect, it } from 'vitest';
import { formatDateLabel } from '../../src/components/graphs/v2/formatters';

describe('formatDateLabel', () => {
  it('formats ISO dates to dd MMM', () => {
    expect(formatDateLabel('2024-02-07')).toBe('07 Feb');
  });

  it('formats month-day labels to dd MMM', () => {
    expect(formatDateLabel('Jan 5')).toBe('05 Jan');
  });

  it('returns original label when date parsing fails', () => {
    expect(formatDateLabel('Run 1')).toBe('Run 1');
  });
});
