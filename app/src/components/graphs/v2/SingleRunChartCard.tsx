import { memo, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import type { Chart } from '../../../services/chatService';
import { EmptyState } from './EmptyState';
import { formatValue } from './formatters';

type SingleRunChartCardProps = {
  charts: Chart[];
};

type MetricOption = {
  id: string;
  label: string;
  unit: string;
  chart: Chart;
};

const METRIC_PRIORITY: Array<{ key: string; pattern: RegExp }> = [
  { key: 'pace', pattern: /pace|min\/km/i },
  { key: 'hr', pattern: /heart|hr|bpm/i },
  { key: 'cadence', pattern: /cadence|spm/i },
  { key: 'elevation', pattern: /elev|altitude|elevation/i },
];

const sanitizeMetricLabel = (title: string): string => {
  return title.replace(/\(.*?\)/g, '').replace(/over\s+\w+/i, '').trim();
};

const getTickIndices = (count: number): number[] => {
  if (count <= 1) return [0];
  const desiredTicks = Math.min(6, count);
  const step = Math.max(1, Math.floor((count - 1) / (desiredTicks - 1)));
  const indices = new Set<number>();
  for (let i = 0; i < count; i += step) {
    indices.add(i);
  }
  indices.add(count - 1);
  return Array.from(indices).sort((a, b) => a - b);
};

export const SingleRunChartCard = memo(({ charts }: SingleRunChartCardProps) => {
  const metricOptions = useMemo<MetricOption[]>(() => {
    if (!charts || charts.length === 0) return [];

    return charts
      .filter((chart) => chart && chart.series?.length)
      .map((chart) => ({
        id: chart.id,
        label: sanitizeMetricLabel(chart.title),
        unit: chart.yLabel || chart.series?.[0]?.unit || '',
        chart,
      }));
  }, [charts]);

  const [primaryMetricId, setPrimaryMetricId] = useState<string>('');
  const [secondaryMetricId, setSecondaryMetricId] = useState<string>('');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!metricOptions.length) {
      setPrimaryMetricId('');
      setSecondaryMetricId('');
      return;
    }

    if (!primaryMetricId || !metricOptions.some((option) => option.id === primaryMetricId)) {
      const paceOption = metricOptions.find((option) =>
        METRIC_PRIORITY[0].pattern.test(option.label)
      );
      setPrimaryMetricId(paceOption?.id ?? metricOptions[0].id);
    }
  }, [metricOptions, primaryMetricId]);

  useEffect(() => {
    if (!metricOptions.length) return;

    if (secondaryMetricId && secondaryMetricId === primaryMetricId) {
      setSecondaryMetricId('');
      return;
    }

    if (!secondaryMetricId) {
      const candidate = metricOptions.find((option) =>
        METRIC_PRIORITY[1].pattern.test(option.label)
      );
      if (candidate && candidate.id !== primaryMetricId) {
        setSecondaryMetricId(candidate.id);
      }
    }
  }, [metricOptions, primaryMetricId, secondaryMetricId]);

  const primaryOption = metricOptions.find((option) => option.id === primaryMetricId);
  const secondaryOption = metricOptions.find((option) => option.id === secondaryMetricId);

  const primaryChart = primaryOption?.chart;
  const secondaryChart = secondaryOption?.chart;
  const primarySeries = primaryChart?.series?.[0];
  const secondarySeries = secondaryChart?.series?.[0];

  const chartData = useMemo(() => {
    if (!primaryChart || !primarySeries || !primaryChart.xLabels?.length) {
      return null;
    }

    const primaryData = primarySeries.data ?? [];
    if (primaryData.length === 0) return null;

    const secondaryData = secondarySeries?.data ?? [];
    const length = Math.min(
      primaryData.length,
      primaryChart.xLabels.length,
      secondaryData.length > 0 ? secondaryData.length : primaryData.length
    );

    const xLabels = primaryChart.xLabels.slice(0, length);
    const primarySlice = primaryData.slice(0, length);
    const secondarySlice = secondaryData.slice(0, length);

    const primaryMin = Math.min(...primarySlice);
    const primaryMax = Math.max(...primarySlice);

    const secondaryMin =
      secondarySlice.length > 0 ? Math.min(...secondarySlice) : 0;
    const secondaryMax =
      secondarySlice.length > 0 ? Math.max(...secondarySlice) : 0;

    const width = 640;
    const height = 240;
    const padding = 36;
    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;
    const xStep = primarySlice.length > 1 ? innerWidth / (primarySlice.length - 1) : innerWidth;

    const primaryPoints = primarySlice.map((value, index) => {
      const x = padding + index * xStep;
      const ratio =
        primaryMax === primaryMin ? 0.5 : (value - primaryMin) / (primaryMax - primaryMin);
      const y = padding + (1 - Math.min(Math.max(ratio, 0), 1)) * innerHeight;
      return { x, y, value };
    });

    const primaryPath = primaryPoints
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');

    const secondaryPoints = secondarySlice.map((value, index) => {
      const x = padding + index * xStep;
      const ratio =
        secondaryMax === secondaryMin ? 0.5 : (value - secondaryMin) / (secondaryMax - secondaryMin);
      const y = padding + (1 - Math.min(Math.max(ratio, 0), 1)) * innerHeight;
      return { x, y, value };
    });

    const secondaryPath = secondaryPoints
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');

    const tickIndices = getTickIndices(xLabels.length);

    return {
      width,
      height,
      padding,
      primaryPoints,
      primaryPath,
      secondaryPoints,
      secondaryPath,
      tickIndices,
      xLabels,
      primaryLabel: primaryOption?.label ?? primaryChart.title,
      secondaryLabel: secondaryOption?.label ?? secondaryChart?.title,
      primaryUnit: primaryOption?.unit || primaryChart.yLabel,
      secondaryUnit: secondaryOption?.unit || secondaryChart?.yLabel,
      primaryData: primarySlice,
      secondaryData: secondarySlice,
    };
  }, [primaryChart, primarySeries, secondarySeries, primaryOption, secondaryOption]);

  if (!charts || charts.length === 0) {
    return null;
  }

  const titleParts = [chartData?.primaryLabel, chartData?.secondaryLabel].filter(Boolean);
  const title = titleParts.length ? titleParts.join(' & ') : 'Last Run';

  const handleMouseMove = (event: MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !chartData) return;
    if (chartData.xLabels.length === 0) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left - chartData.padding;
    const xStep =
      chartData.primaryPoints.length > 1
        ? (chartData.width - chartData.padding * 2) / (chartData.primaryPoints.length - 1)
        : chartData.width - chartData.padding * 2;
    const index = Math.round(x / xStep);
    if (index < 0 || index >= chartData.xLabels.length) {
      setHoveredIndex(null);
      return;
    }
    setHoveredIndex(index);
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  return (
    <div className="chart-list graph-widget graph-widget--single">
      <div className="graph-card">
        <div className="graph-card-header graph-card-header--controls">
          <div>
            <div className="graph-card-title">{title}</div>
            <div className="graph-card-subtitle">Last run — select up to two metrics.</div>
          </div>
        </div>

        <div className="graph-controls graph-controls--single">
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
            <label className="graph-control-label">Secondary metric</label>
            <select
              className="graph-select"
              value={secondaryMetricId}
              onChange={(event) => setSecondaryMetricId(event.target.value)}
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
        </div>

        {!chartData ? (
          <EmptyState />
        ) : (
          <div className="graph-chart">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${chartData.width} ${chartData.height}`}
              role="img"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <rect
                x={0}
                y={0}
                width={chartData.width}
                height={chartData.height}
                fill="none"
              />

              <line
                x1={chartData.padding}
                y1={chartData.height - chartData.padding}
                x2={chartData.width - chartData.padding}
                y2={chartData.height - chartData.padding}
                stroke="#e5e7eb"
              />
              <line
                x1={chartData.padding}
                y1={chartData.padding}
                x2={chartData.padding}
                y2={chartData.height - chartData.padding}
                stroke="#e5e7eb"
              />

              <path
                d={`${chartData.primaryPath} L ${
                  chartData.primaryPoints[chartData.primaryPoints.length - 1]?.x ?? chartData.padding
                } ${chartData.height - chartData.padding} L ${
                  chartData.primaryPoints[0]?.x ?? chartData.padding
                } ${chartData.height - chartData.padding} Z`}
                fill="rgba(37, 99, 235, 0.2)"
                stroke="none"
              />
              <path
                d={chartData.primaryPath}
                fill="none"
                stroke="var(--graph-primary)"
                strokeWidth={2.5}
              />

              {secondaryMetricId && chartData.secondaryPoints.length > 0 && (
                <path
                  d={chartData.secondaryPath}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth={2.2}
                />
              )}

              {hoveredIndex !== null && chartData.primaryPoints[hoveredIndex] && (
                <circle
                  cx={chartData.primaryPoints[hoveredIndex].x}
                  cy={chartData.primaryPoints[hoveredIndex].y}
                  r={4}
                  fill="var(--graph-primary)"
                  stroke="white"
                  strokeWidth={1.5}
                />
              )}

              {hoveredIndex !== null &&
                secondaryMetricId &&
                chartData.secondaryPoints[hoveredIndex] && (
                  <circle
                    cx={chartData.secondaryPoints[hoveredIndex].x}
                    cy={chartData.secondaryPoints[hoveredIndex].y}
                    r={4}
                    fill="#ef4444"
                    stroke="white"
                    strokeWidth={1.5}
                  />
                )}

              {chartData.tickIndices.map((index) => {
                const label = chartData.xLabels[index];
                const x = chartData.primaryPoints[index]?.x ?? chartData.padding;
                return (
                  <text
                    key={`x-label-${index}`}
                    x={x}
                    y={chartData.height - chartData.padding + 18}
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--slate-600)"
                  >
                    {label}
                  </text>
                );
              })}

              {chartData.primaryUnit && (
                <text
                  x={chartData.padding}
                  y={chartData.padding - 10}
                  fontSize="11"
                  fill="var(--graph-primary)"
                >
                  {chartData.primaryUnit}
                </text>
              )}
              {chartData.secondaryUnit && secondaryMetricId && (
                <text
                  x={chartData.width - chartData.padding}
                  y={chartData.padding - 10}
                  textAnchor="end"
                  fontSize="11"
                  fill="#ef4444"
                >
                  {chartData.secondaryUnit}
                </text>
              )}
            </svg>
            {hoveredIndex !== null && (
              <div
                className="graph-tooltip"
                style={{
                  left: chartData.primaryPoints[hoveredIndex]?.x ?? chartData.padding,
                }}
              >
                <div className="graph-tooltip-date">
                  {chartData.xLabels[hoveredIndex]}
                </div>
                <div className="graph-tooltip-row">
                  <span className="graph-tooltip-dot" style={{ backgroundColor: 'var(--graph-primary)' }} />
                  <span>{chartData.primaryLabel}</span>
                  <span className="graph-tooltip-value">
                    {formatValue(
                      chartData.primaryData[hoveredIndex],
                      chartData.primaryUnit
                    )}
                  </span>
                </div>
                {secondaryMetricId && chartData.secondaryData[hoveredIndex] !== undefined && (
                  <div className="graph-tooltip-row">
                    <span className="graph-tooltip-dot" style={{ backgroundColor: '#ef4444' }} />
                    <span>{chartData.secondaryLabel}</span>
                    <span className="graph-tooltip-value">
                      {formatValue(
                        chartData.secondaryData[hoveredIndex],
                        chartData.secondaryUnit
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}
            <div className="graph-metric-summary">
              <div className="graph-metric-label">Latest</div>
              <div className="graph-metric-value">
                {formatValue(
                  chartData.primaryData[chartData.primaryData.length - 1],
                  chartData.primaryUnit
                )}
              </div>
              {secondaryMetricId && chartData.secondaryData.length > 0 && (
                <div className="graph-metric-value graph-metric-value--secondary">
                  {formatValue(
                    chartData.secondaryData[chartData.secondaryData.length - 1],
                    chartData.secondaryUnit
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

SingleRunChartCard.displayName = 'SingleRunChartCard';
