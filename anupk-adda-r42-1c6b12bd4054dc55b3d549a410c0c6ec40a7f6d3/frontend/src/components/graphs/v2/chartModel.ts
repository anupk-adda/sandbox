import type { Chart } from '../../../services/chatService';

export type ChartVariant = 'single_run' | 'trend_compare' | 'empty';

const TREND_MAX_POINTS = 12;
const TIME_SERIES_MIN_POINTS = 13;

const isValidChart = (chart: Chart | undefined): chart is Chart => {
  return Boolean(
    chart &&
      chart.id &&
      Array.isArray(chart.xLabels) &&
      chart.xLabels.length > 0 &&
      Array.isArray(chart.series) &&
      chart.series.length > 0
  );
};

const getPointCount = (chart: Chart): number => {
  return chart.series?.[0]?.data?.length ?? 0;
};

const hasTimeSeriesPoints = (chart: Chart): boolean => {
  const labelCount = chart.xLabels.length;
  const pointCount = getPointCount(chart);
  return labelCount >= TIME_SERIES_MIN_POINTS && pointCount === labelCount;
};

const hasNumericProgression = (chart: Chart): boolean => {
  if (!chart.xLabels.length) return false;
  const numericValues = chart.xLabels
    .map((label) => Number.parseFloat(label))
    .filter((value) => Number.isFinite(value));

  if (numericValues.length / chart.xLabels.length < 0.7) {
    return false;
  }

  for (let i = 1; i < numericValues.length; i += 1) {
    if (numericValues[i] < numericValues[i - 1]) {
      return false;
    }
  }

  return true;
};

const hasAggregatePoints = (chart: Chart): boolean => {
  const labelCount = chart.xLabels.length;
  const pointCount = getPointCount(chart);
  return labelCount > 1 && labelCount <= TREND_MAX_POINTS && pointCount === labelCount;
};

export const inferChartVariant = (charts?: Chart[]): ChartVariant => {
  if (!charts || charts.length === 0) {
    return 'empty';
  }

  const validCharts = charts.filter(isValidChart);
  if (validCharts.length === 0) {
    return 'empty';
  }

  if (validCharts.some(hasTimeSeriesPoints) || validCharts.some(hasNumericProgression)) {
    return 'single_run';
  }

  if (validCharts.some(hasAggregatePoints)) {
    return 'trend_compare';
  }

  return 'empty';
};
