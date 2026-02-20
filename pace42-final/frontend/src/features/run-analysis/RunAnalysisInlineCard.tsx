import { useMemo, useState } from 'react';
import { MetricPicker } from './MetricPicker';
import { RunCompareChart } from './RunCompareChart';
import {
  DEFAULT_PRIMARY_METRIC,
  DEFAULT_SECONDARY_METRIC,
  METRICS,
  type MetricId,
  type RunSample,
} from './runAnalysisUtils';

type RunAnalysisInlineCardProps = {
  samples: RunSample[];
};

export const RunAnalysisInlineCard = ({ samples }: RunAnalysisInlineCardProps) => {
  const [primaryMetric, setPrimaryMetric] = useState<MetricId>(DEFAULT_PRIMARY_METRIC);
  const [secondaryMetric, setSecondaryMetric] = useState<MetricId | ''>(DEFAULT_SECONDARY_METRIC);
  const [xAxis, setXAxis] = useState<'time' | 'distance'>('time');

  const availableMetrics = useMemo(() => {
    if (!samples.length) return METRICS;
    return METRICS.filter((metric) =>
      samples.some((sample) => sample.metrics[metric.id] !== null && sample.metrics[metric.id] !== undefined)
    );
  }, [samples]);

  return (
    <div className="glass-card p-5 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <div className="text-white font-semibold">Run Analysis</div>
          <div className="text-white/50 text-xs mt-1">Overlay two metrics for this run.</div>
        </div>
        <div className="run-analysis__toggle">
          <button
            type="button"
            className={xAxis === 'time' ? 'active' : ''}
            onClick={() => setXAxis('time')}
          >
            Time
          </button>
          <button
            type="button"
            className={xAxis === 'distance' ? 'active' : ''}
            onClick={() => setXAxis('distance')}
          >
            Distance
          </button>
        </div>
      </div>

      <div className="run-analysis__controls">
        <MetricPicker
          label="Primary metric"
          value={primaryMetric}
          options={availableMetrics}
          onChange={(next) => setPrimaryMetric(next || DEFAULT_PRIMARY_METRIC)}
        />
        <MetricPicker
          label="Secondary metric"
          value={secondaryMetric}
          options={availableMetrics.filter((metric) => metric.id !== primaryMetric)}
          allowNone
          onChange={(next) => setSecondaryMetric(next)}
        />
      </div>

      <RunCompareChart
        samples={samples}
        primaryMetricId={primaryMetric}
        secondaryMetricId={secondaryMetric}
        xAxis={xAxis}
      />
    </div>
  );
};
