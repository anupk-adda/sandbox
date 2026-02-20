import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MetricPicker } from './MetricPicker';
import { RunCompareChart } from './RunCompareChart';
import {
  DEFAULT_PRIMARY_METRIC,
  DEFAULT_SECONDARY_METRIC,
  METRICS,
  type MetricId,
} from './runAnalysisUtils';
import { buildMockRunSamples } from './mockRunData';
import './runAnalysis.css';

export default function RunAnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const [primaryMetric, setPrimaryMetric] = useState<MetricId>(DEFAULT_PRIMARY_METRIC);
  const [secondaryMetric, setSecondaryMetric] = useState<MetricId | ''>(DEFAULT_SECONDARY_METRIC);
  const [xAxis, setXAxis] = useState<'time' | 'distance'>('time');

  const samples = useMemo(() => buildMockRunSamples(), [id]);

  return (
    <div className="run-analysis">
      <div className="max-w-5xl mx-auto">
        <div className="run-analysis__header">
          <div>
            <div className="text-sm uppercase tracking-[0.2em] text-white/40 font-mono">
              Run Analysis
            </div>
            <h1 className="run-analysis__title">Analyze My Last Run</h1>
            <p className="run-analysis__subtitle">
              Overlay two metrics and inspect how your effort evolved across the run.
            </p>
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
            options={METRICS}
            onChange={(next) => setPrimaryMetric(next || DEFAULT_PRIMARY_METRIC)}
          />
          <MetricPicker
            label="Secondary metric"
            value={secondaryMetric}
            options={METRICS.filter((metric) => metric.id !== primaryMetric)}
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
    </div>
  );
}
