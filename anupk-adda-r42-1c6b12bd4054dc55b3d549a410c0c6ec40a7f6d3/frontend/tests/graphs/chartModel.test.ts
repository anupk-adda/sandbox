import { describe, expect, it } from 'vitest';
import type { Chart } from '../../src/services/chatService';
import { inferChartVariant } from '../../src/components/graphs/v2/chartModel';

const makeChart = (overrides: Partial<Chart> = {}): Chart => ({
  id: overrides.id ?? 'chart',
  type: 'line',
  title: overrides.title ?? 'Chart',
  xLabels: overrides.xLabels ?? ['1', '2', '3'],
  yLabel: overrides.yLabel,
  series: overrides.series ?? [
    {
      label: 'Metric',
      data: overrides.series?.[0]?.data ?? [1, 2, 3],
    },
  ],
  note: overrides.note,
});

describe('inferChartVariant', () => {
  it('detects single-run time series charts', () => {
    const labels = Array.from({ length: 24 }, (_, idx) => `${idx}`);
    const data = labels.map((_, idx) => idx + 1);
    const charts = [makeChart({ xLabels: labels, series: [{ label: 'Pace', data }] })];
    expect(inferChartVariant(charts)).toBe('single_run');
  });

  it('detects trend charts with small aggregates', () => {
    const labels = ['Jan 01', 'Jan 02', 'Jan 03', 'Jan 04'];
    const data = [5, 4, 4.2, 4.5];
    const charts = [makeChart({ xLabels: labels, series: [{ label: 'Pace', data }] })];
    expect(inferChartVariant(charts)).toBe('trend_compare');
  });

  it('returns empty when charts are missing', () => {
    expect(inferChartVariant([])).toBe('empty');
    expect(inferChartVariant(undefined)).toBe('empty');
  });
});
