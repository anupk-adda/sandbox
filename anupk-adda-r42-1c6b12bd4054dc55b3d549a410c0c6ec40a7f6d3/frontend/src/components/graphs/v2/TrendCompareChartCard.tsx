import { memo, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import type { Chart } from '../../../services/chatService';
import { chatService } from '../../../services/chatService';
import { EmptyState } from './EmptyState';
import { formatDateLabel, formatValue } from './formatters';
import { normalizeRelative } from './normalize';

const RANGE_OPTIONS = [4, 8] as const;

type TrendCompareChartCardProps = {
  charts: Chart[];
};

type MetricOption = {
  id: string;
  label: string;
  unit: string;
  data: number[];
};

const PRIMARY_COLOR = 'var(--graph-primary)';
const COMPARE_COLOR = 'var(--graph-compare)';

const sanitizeMetricLabel = (title: string): string => {
  return title.replace(/\(.*?\)/g, '').replace(/average\s+/i, '').trim();
};

export const TrendCompareChartCard = memo(({ charts: initialCharts }: TrendCompareChartCardProps) => {
  const [charts, setCharts] = useState<Chart[]>(initialCharts);
  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]>(4);
  const [primaryMetricId, setPrimaryMetricId] = useState<string>('');
  const [compareMetricId, setCompareMetricId] = useState<string>('');
  const [displayMode, setDisplayMode] = useState<'relative' | 'actual'>('relative');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const lastFetchedCountRef = useRef<number>(0);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    setCharts(initialCharts);
  }, [initialCharts]);

  const metricOptions = useMemo<MetricOption[]>(() => {
    if (!charts || charts.length === 0) return [];

    return charts
      .filter((chart) => chart && chart.id && chart.series?.length)
      .map((chart) => ({
        id: chart.id,
        label: sanitizeMetricLabel(chart.title),
        unit: chart.yLabel || chart.series?.[0]?.unit || '',
        data: chart.series?.[0]?.data ?? [],
      }));
  }, [charts]);

  useEffect(() => {
    if (!primaryMetricId && metricOptions.length > 0) {
      setPrimaryMetricId(metricOptions[0].id);
    }
  }, [metricOptions, primaryMetricId]);

  useEffect(() => {
    if (compareMetricId && compareMetricId === primaryMetricId) {
      setCompareMetricId('');
    }
  }, [compareMetricId, primaryMetricId]);

  const handleRangeChange = async (nextRange: (typeof RANGE_OPTIONS)[number]) => {
    setRange(nextRange);
    setNotice(null);

    const currentLength = charts[0]?.xLabels?.length ?? 0;
    if (nextRange <= currentLength || lastFetchedCountRef.current === nextRange) {
      return;
    }

    setIsLoading(true);
    try {
      const nextCharts = await chatService.fetchRunData(nextRange);
      if (nextCharts && nextCharts.length > 0) {
        setCharts(nextCharts);
        lastFetchedCountRef.current = nextRange;
      } else {
        setNotice('Not enough data to load more runs.');
      }
    } catch (err) {
      setNotice('Unable to load more runs right now.');
    } finally {
      setIsLoading(false);
    }
  };

  const primaryMetric = useMemo(
    () => metricOptions.find((metric) => metric.id === primaryMetricId),
    [metricOptions, primaryMetricId]
  );

  const compareMetric = useMemo(
    () => metricOptions.find((metric) => metric.id === compareMetricId),
    [metricOptions, compareMetricId]
  );

  const chartModel = useMemo(() => {
    const baseChart = charts[0];
    const rawLabels = baseChart?.xLabels ?? [];
    const labelSlice = rawLabels.slice(-range);
    const formattedLabels = labelSlice.map(formatDateLabel);

    const primaryData = primaryMetric?.data ?? [];
    const compareData = compareMetric?.data ?? [];

    const length = Math.min(
      formattedLabels.length,
      primaryData.length || formattedLabels.length
    );

    const labels = formattedLabels.slice(-length);
    const primarySlice = primaryData.slice(-length);

    const compareLength = Math.min(labels.length, compareData.length);
    const compareSlice = compareMetricId ? compareData.slice(-compareLength) : [];
    const compareOffset = labels.length - compareSlice.length;

    return {
      labels,
      rawLabels: labelSlice.slice(-length),
      primarySlice,
      compareSlice,
      compareOffset,
    };
  }, [charts, range, primaryMetric, compareMetric, compareMetricId]);

  const primaryHasData =
    chartModel.primarySlice.length > 0 &&
    chartModel.primarySlice.some((value) => Number.isFinite(value));

  const compareHasData =
    Boolean(compareMetricId) &&
    chartModel.compareSlice.length > 0 &&
    chartModel.compareSlice.some((value) => Number.isFinite(value));

  const compareUnavailable = Boolean(compareMetricId) && !compareHasData;

  const chartGeometry = useMemo(() => {
    const width = 640;
    const height = 250;
    const padding = 36;
    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;
    const count = chartModel.labels.length;
    const xStep = count > 1 ? innerWidth / (count - 1) : innerWidth;
    return { width, height, padding, innerWidth, innerHeight, xStep };
  }, [chartModel.labels.length]);

  const buildPoints = (values: number[], min: number, max: number, offset = 0) => {
    if (values.length === 0) return [];
    const { padding, innerHeight, xStep } = chartGeometry;
    return values.map((value, index) => {
      const ratio = max === min ? 0.5 : (value - min) / (max - min);
      const y = padding + (1 - Math.min(Math.max(ratio, 0), 1)) * innerHeight;
      return {
        x: padding + (index + offset) * xStep,
        y,
      };
    });
  };

  const primarySeries = useMemo(() => {
    if (!primaryMetric || chartModel.primarySlice.length === 0) return null;

    if (displayMode === 'relative') {
      const normalized = normalizeRelative(chartModel.primarySlice, primaryMetric.unit);
      return {
        values: normalized.values,
        rawValues: chartModel.primarySlice,
        min: 0,
        max: 100,
        unit: primaryMetric.unit,
        label: primaryMetric.label,
        color: PRIMARY_COLOR,
      };
    }

    const min = Math.min(...chartModel.primarySlice);
    const max = Math.max(...chartModel.primarySlice);
    return {
      values: chartModel.primarySlice,
      rawValues: chartModel.primarySlice,
      min,
      max,
      unit: primaryMetric.unit,
      label: primaryMetric.label,
      color: PRIMARY_COLOR,
    };
  }, [chartModel.primarySlice, displayMode, primaryMetric]);

  const compareSeries = useMemo(() => {
    if (!compareMetric || chartModel.compareSlice.length === 0) return null;

    if (displayMode === 'relative') {
      const normalized = normalizeRelative(chartModel.compareSlice, compareMetric.unit);
      return {
        values: normalized.values,
        rawValues: chartModel.compareSlice,
        min: 0,
        max: 100,
        unit: compareMetric.unit,
        label: compareMetric.label,
        color: COMPARE_COLOR,
      };
    }

    const min = Math.min(...chartModel.compareSlice);
    const max = Math.max(...chartModel.compareSlice);
    return {
      values: chartModel.compareSlice,
      rawValues: chartModel.compareSlice,
      min,
      max,
      unit: compareMetric.unit,
      label: compareMetric.label,
      color: COMPARE_COLOR,
    };
  }, [chartModel.compareSlice, displayMode, compareMetric]);

  const primaryPoints = useMemo(() => {
    if (!primarySeries) return [];
    return buildPoints(primarySeries.values, primarySeries.min, primarySeries.max);
  }, [primarySeries, chartGeometry]);

  const comparePoints = useMemo(() => {
    if (!compareSeries) return [];
    return buildPoints(
      compareSeries.values,
      compareSeries.min,
      compareSeries.max,
      chartModel.compareOffset
    );
  }, [compareSeries, chartGeometry, chartModel.compareOffset]);

  const buildPath = (points: Array<{ x: number; y: number }>) => {
    if (points.length === 0) return '';
    return points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');
  };

  const handleMouseMove = (event: MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    if (chartModel.labels.length === 0) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left - chartGeometry.padding;
    const index = Math.round(x / chartGeometry.xStep);
    if (index < 0 || index >= chartModel.labels.length) {
      setHoveredIndex(null);
      return;
    }
    setHoveredIndex(index);
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  if (!charts || charts.length === 0 || metricOptions.length === 0) {
    return (
      <div className="chart-list graph-widget graph-widget--trend">
        <div className="graph-card">
          <div className="graph-card-title">Trend Compare</div>
          <EmptyState message="No trend data available yet." />
        </div>
      </div>
    );
  }

  return (
    <div className="chart-list graph-widget graph-widget--trend">
      <div className="graph-card">
        <div className="graph-card-header graph-card-header--controls">
          <div>
            <div className="graph-card-title">Trend Compare</div>
            <div className="graph-card-subtitle">Compare recent runs, max two metrics.</div>
          </div>
          <button
            type="button"
            className="graph-advanced-toggle"
            onClick={() => setShowAdvanced((prev) => !prev)}
          >
            {showAdvanced ? 'Hide Advanced' : 'Advanced'}
          </button>
        </div>

        <div className="graph-controls">
          <div className="graph-control">
            <label className="graph-control-label">Primary metric</label>
            <select
              className="graph-select"
              value={primaryMetricId}
              onChange={(event) => setPrimaryMetricId(event.target.value)}
            >
              {metricOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="graph-control">
            <label className="graph-control-label">Compare with</label>
            <select
              className="graph-select"
              value={compareMetricId}
              onChange={(event) => setCompareMetricId(event.target.value)}
            >
              <option value="">None</option>
              {metricOptions
                .filter((option) => option.id !== primaryMetricId)
                .map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
            </select>
          </div>

          <div className="graph-control">
            <label className="graph-control-label">Range</label>
            <div className="graph-toggle">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`graph-toggle-btn ${range === option ? 'active' : ''}`}
                  onClick={() => handleRangeChange(option)}
                  disabled={isLoading}
                >
                  {isLoading && range === option ? 'Loading...' : `Last ${option}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {showAdvanced && (
          <div className="graph-advanced">
            <div className="graph-control">
              <label className="graph-control-label">Display mode</label>
              <div className="graph-toggle">
                <button
                  type="button"
                  className={`graph-toggle-btn ${displayMode === 'relative' ? 'active' : ''}`}
                  onClick={() => setDisplayMode('relative')}
                >
                  Relative
                </button>
                <button
                  type="button"
                  className={`graph-toggle-btn ${displayMode === 'actual' ? 'active' : ''}`}
                  onClick={() => setDisplayMode('actual')}
                >
                  Actual
                </button>
              </div>
            </div>
          </div>
        )}

        {(notice || compareUnavailable) && (
          <div className="graph-note">
            {notice ?? 'Compare metric has no data for this range.'}
          </div>
        )}

        {!primaryHasData || chartModel.labels.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="graph-chart-wrap">
            <div className="graph-legend">
              {primarySeries && (
                <span className="graph-legend-item">
                  <span
                    className="graph-legend-swatch"
                    style={{ backgroundColor: primarySeries.color }}
                  />
                  {primarySeries.label}
                </span>
              )}
              {compareSeries && compareHasData && (
                <span className="graph-legend-item">
                  <span
                    className="graph-legend-swatch"
                    style={{ backgroundColor: compareSeries.color }}
                  />
                  {compareSeries.label}
                </span>
              )}
            </div>

            <svg
              ref={svgRef}
              viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
              role="img"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <rect
                x={0}
                y={0}
                width={chartGeometry.width}
                height={chartGeometry.height}
                fill="none"
              />

              <line
                x1={chartGeometry.padding}
                y1={chartGeometry.height - chartGeometry.padding}
                x2={chartGeometry.width - chartGeometry.padding}
                y2={chartGeometry.height - chartGeometry.padding}
                stroke="#e5e7eb"
              />
              <line
                x1={chartGeometry.padding}
                y1={chartGeometry.padding}
                x2={chartGeometry.padding}
                y2={chartGeometry.height - chartGeometry.padding}
                stroke="#e5e7eb"
              />

              {primaryPoints.length > 0 && (
                <path
                  d={buildPath(primaryPoints)}
                  fill="none"
                  stroke={PRIMARY_COLOR}
                  strokeWidth={2.4}
                />
              )}

              {comparePoints.length > 0 && (
                <path
                  d={buildPath(comparePoints)}
                  fill="none"
                  stroke={COMPARE_COLOR}
                  strokeWidth={2.2}
                />
              )}

              {chartModel.labels.map((label, index) => {
                const x = chartGeometry.padding + index * chartGeometry.xStep;
                return (
                  <text
                    key={`x-label-${index}`}
                    x={x}
                    y={chartGeometry.height - chartGeometry.padding + 18}
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--slate-600)"
                  >
                    {label}
                  </text>
                );
              })}

              {primarySeries && (
                <text
                  x={chartGeometry.padding}
                  y={chartGeometry.padding - 10}
                  fontSize="11"
                  fill={PRIMARY_COLOR}
                >
                  {primarySeries.label}
                </text>
              )}
            </svg>

            {hoveredIndex !== null && primarySeries && (
              <div
                className="graph-tooltip"
                style={{
                  left:
                    chartGeometry.padding +
                    hoveredIndex * chartGeometry.xStep,
                }}
              >
                <div className="graph-tooltip-date">
                  {chartModel.labels[hoveredIndex] ?? chartModel.rawLabels[hoveredIndex]}
                </div>
                <div className="graph-tooltip-row">
                  <span className="graph-tooltip-dot" style={{ backgroundColor: PRIMARY_COLOR }} />
                  <span>{primarySeries.label}</span>
                  <span className="graph-tooltip-value">
                    {formatValue(primarySeries.rawValues[hoveredIndex], primarySeries.unit)}
                  </span>
                </div>
                {compareSeries && compareHasData && (
                  <div className="graph-tooltip-row">
                    <span className="graph-tooltip-dot" style={{ backgroundColor: COMPARE_COLOR }} />
                    <span>{compareSeries.label}</span>
                    <span className="graph-tooltip-value">
                      {formatValue(compareSeries.rawValues[hoveredIndex], compareSeries.unit)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {displayMode === 'relative' && (
          <div className="graph-note">
            Relative mode normalizes each metric independently. Pace is inverted (faster up).
          </div>
        )}
      </div>
    </div>
  );
});

TrendCompareChartCard.displayName = 'TrendCompareChartCard';
