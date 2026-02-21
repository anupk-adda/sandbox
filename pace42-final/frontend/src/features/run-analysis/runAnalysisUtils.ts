export type MetricId =
  | 'heartRate'
  | 'pace'
  | 'cadence'
  | 'elevation'
  | 'power'
  | 'groundContactTime'
  | 'lapAvgPace'
  | 'strideLength'
  | 'efficiencyIndex';

export type RunSample = {
  timestamp: string;
  distanceKm: number;
  metrics: Partial<Record<MetricId, number | null>>;
};

export type MetricDefinition = {
  id: MetricId;
  label: string;
  unit: string;
  color: string;
  invert?: boolean;
  format: (value: number) => string;
};

const formatPace = (value: number) => {
  if (!Number.isFinite(value)) return '--';
  const minutes = Math.floor(value);
  const seconds = Math.round((value - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const formatNumber = (value: number, suffix = '') => {
  if (!Number.isFinite(value)) return '--';
  return `${Math.round(value)}${suffix}`;
};

const formatDecimal = (value: number, suffix = '') => {
  if (!Number.isFinite(value)) return '--';
  return `${value.toFixed(1)}${suffix}`;
};

const formatRatio = (value: number, suffix = '') => {
  if (!Number.isFinite(value)) return '--';
  return `${value.toFixed(2)}${suffix}`;
};

export const METRICS: MetricDefinition[] = [
  {
    id: 'heartRate',
    label: 'Heart Rate',
    unit: 'bpm',
    color: '#f97316',
    format: (value) => formatNumber(value, ' bpm'),
  },
  {
    id: 'pace',
    label: 'Pace',
    unit: 'min/km',
    color: '#38bdf8',
    invert: true,
    format: formatPace,
  },
  {
    id: 'cadence',
    label: 'Cadence',
    unit: 'spm',
    color: '#a78bfa',
    format: (value) => formatNumber(value, ' spm'),
  },
  {
    id: 'elevation',
    label: 'Elevation',
    unit: 'm',
    color: '#22c55e',
    format: (value) => formatNumber(value, ' m'),
  },
  {
    id: 'power',
    label: 'Power',
    unit: 'w',
    color: '#facc15',
    format: (value) => formatNumber(value, ' w'),
  },
  {
    id: 'groundContactTime',
    label: 'Ground Contact',
    unit: 'ms',
    color: '#f472b6',
    format: (value) => formatNumber(value, ' ms'),
  },
  {
    id: 'lapAvgPace',
    label: 'Lap Avg Pace',
    unit: 'min/km',
    color: '#60a5fa',
    invert: true,
    format: formatPace,
  },
  {
    id: 'strideLength',
    label: 'Stride Length',
    unit: 'm',
    color: '#34d399',
    format: (value) => formatDecimal(value, ' m'),
  },
  {
    id: 'efficiencyIndex',
    label: 'Efficiency Index',
    unit: 'EI',
    color: '#22d3ee',
    format: (value) => formatRatio(value),
  },
];

export const DEFAULT_PRIMARY_METRIC: MetricId = 'heartRate';
export const DEFAULT_SECONDARY_METRIC: MetricId = 'pace';

export const getMetricDefinition = (id: MetricId | ''): MetricDefinition | undefined => {
  if (!id) return undefined;
  return METRICS.find((metric) => metric.id === id);
};

export const isDerivedMetric = (id: MetricId) => id === 'efficiencyIndex';

const paceToSpeedMps = (pace: number | null | undefined) => {
  if (!Number.isFinite(pace as number)) return null;
  const paceValue = pace as number;
  if (paceValue <= 0) return null;
  return 1000 / (paceValue * 60);
};

export const getMetricValue = (sample: RunSample, metric: MetricDefinition): number | null => {
  if (metric.id === 'efficiencyIndex') {
    const hr = sample.metrics.heartRate;
    const pace = sample.metrics.pace;
    if (!Number.isFinite(hr as number) || !Number.isFinite(pace as number)) return null;
    const speed = paceToSpeedMps(pace as number);
    if (!speed || speed <= 0) return null;
    return (speed / (hr as number)) * 100;
  }
  const raw = sample.metrics[metric.id];
  return Number.isFinite(raw as number) ? (raw as number) : null;
};

export const isMetricAvailable = (samples: RunSample[], metric: MetricDefinition) => {
  if (metric.id === 'efficiencyIndex') {
    return samples.some((sample) => {
      const hr = sample.metrics.heartRate;
      const pace = sample.metrics.pace;
      return Number.isFinite(hr as number) && Number.isFinite(pace as number);
    });
  }
  return samples.some((sample) => sample.metrics[metric.id] !== null && sample.metrics[metric.id] !== undefined);
};

export const getNormalizedValue = (value: number | null, metric: MetricDefinition): number | null => {
  if (value === null || !Number.isFinite(value)) return null;
  if (metric.id === 'pace' || metric.invert) {
    const speed = paceToSpeedMps(value);
    return speed ?? null;
  }
  return value;
};

export const formatMetricValue = (metric: MetricDefinition, value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '--';
  }
  return metric.format(value);
};

export const formatElapsedTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
