/**
 * Chart Types
 * Type definitions for the dual-metric Run Trends chart component
 */

export type DisplayMode = 'relative' | 'actual';
// Range options limited to 4 and 10 to match agent/data fetch logic
export type RangeOption = 4 | 10;

export interface MetricOption {
  id: string;
  label: string;
  unit: string;
  data: number[];
  color: string;
}

export interface NormalizedSeries {
  label: string;
  data: number[];
  rawData: number[];
  unit: string;
  color: string;
  min: number;
  max: number;
}

export interface DualMetricChartData {
  xLabels: string[];
  primarySeries: NormalizedSeries | null;
  compareSeries: NormalizedSeries | null;
}

export interface ChartPoint {
  x: number;
  y: number;
}

// Made with Bob