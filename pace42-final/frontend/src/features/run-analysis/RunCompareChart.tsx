import { memo, useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  clamp,
  formatElapsedTime,
  formatMetricValue,
  getMetricDefinition,
  type MetricDefinition,
  type MetricId,
  type RunSample,
} from './runAnalysisUtils';
import './runAnalysis.css';

type RunCompareChartProps = {
  samples: RunSample[];
  primaryMetricId: MetricId;
  secondaryMetricId?: MetricId | '';
  xAxis: 'time' | 'distance';
};

type ChartPoint = {
  x: number;
  y: number;
  value: number;
};

const WIDTH = 780;
const HEIGHT = 300;
const PADDING = {
  top: 24,
  bottom: 36,
  left: 56,
  right: 56,
};

const buildSmoothPath = (points: ChartPoint[]) => {
  if (points.length < 2) return '';
  const smoothing = 0.2;
  const d = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1] || curr;
    const prevPrev = points[i - 2] || prev;

    const cp1x = prev.x + (curr.x - prevPrev.x) * smoothing;
    const cp1y = prev.y + (curr.y - prevPrev.y) * smoothing;
    const cp2x = curr.x - (next.x - prev.x) * smoothing;
    const cp2y = curr.y - (next.y - prev.y) * smoothing;

    d.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`);
  }
  return d.join(' ');
};

const buildPoints = (
  values: Array<number | null>,
  xPositions: number[],
  domain: { min: number; max: number },
  invert?: boolean
) => {
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
  return values.map((value, index) => {
    if (value === null) return null;
    const ratio = domain.max === domain.min ? 0.5 : (value - domain.min) / (domain.max - domain.min);
    const y = invert
      ? PADDING.top + ratio * innerHeight
      : PADDING.top + (1 - ratio) * innerHeight;
    return {
      x: xPositions[index],
      y,
      value,
    };
  });
};

const extractValues = (samples: RunSample[], metric: MetricDefinition | undefined) => {
  if (!metric) return [];
  return samples.map((sample) => {
    const raw = sample.metrics[metric.id];
    return Number.isFinite(raw as number) ? (raw as number) : null;
  });
};

const computeDomain = (values: Array<number | null>) => {
  const numeric = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!numeric.length) {
    return { min: 0, max: 1 };
  }
  let min = Math.min(...numeric);
  let max = Math.max(...numeric);
  if (min === max) {
    min -= 1;
    max += 1;
  } else {
    const padding = (max - min) * 0.12;
    min -= padding;
    max += padding;
  }
  return { min, max };
};

const buildSegments = (points: Array<ChartPoint | null>) => {
  const segments: ChartPoint[][] = [];
  let current: ChartPoint[] = [];
  points.forEach((point) => {
    if (!point) {
      if (current.length) {
        segments.push(current);
        current = [];
      }
      return;
    }
    current.push(point);
  });
  if (current.length) segments.push(current);
  return segments;
};

const buildTicks = (domain: { min: number; max: number }) => {
  const ticks = 5;
  const denom = Math.max(1, ticks - 1);
  return Array.from({ length: ticks }).map((_, index) => {
    const ratio = index / denom;
    return domain.min + (domain.max - domain.min) * ratio;
  });
};

export const RunCompareChart = memo(
  ({ samples, primaryMetricId, secondaryMetricId, xAxis }: RunCompareChartProps) => {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const primaryMetric = getMetricDefinition(primaryMetricId);
    const secondaryMetric = getMetricDefinition(secondaryMetricId || '');

    const chartModel = useMemo(() => {
      if (!samples.length || !primaryMetric) {
        return null;
      }

      const sorted = [...samples].sort((a, b) => {
        const left = xAxis === 'distance'
          ? a.distanceKm
          : new Date(a.timestamp).getTime();
        const right = xAxis === 'distance'
          ? b.distanceKm
          : new Date(b.timestamp).getTime();
        return left - right;
      });

      const firstTimestamp = new Date(sorted[0].timestamp).getTime();
      const xValues = sorted.map((sample) =>
        xAxis === 'distance'
          ? sample.distanceKm
          : (new Date(sample.timestamp).getTime() - firstTimestamp) / 1000
      );

      const minX = Math.min(...xValues);
      const maxX = Math.max(...xValues);
      const innerWidth = WIDTH - PADDING.left - PADDING.right;
      const xPositions = xValues.map((value) => {
        const ratio = maxX === minX ? 0.5 : (value - minX) / (maxX - minX);
        return PADDING.left + ratio * innerWidth;
      });

      const primaryValues = extractValues(sorted, primaryMetric);
      const secondaryValues = extractValues(sorted, secondaryMetric);

      const primaryDomain = computeDomain(primaryValues);
      const secondaryDomain = computeDomain(secondaryValues);
      const shareAxis =
        secondaryMetric &&
        primaryMetric.unit === secondaryMetric.unit &&
        primaryMetric.invert === secondaryMetric.invert;
      const secondaryDomainForPlot = shareAxis ? primaryDomain : secondaryDomain;

      const primaryPoints = buildPoints(primaryValues, xPositions, primaryDomain, primaryMetric.invert);
      const secondaryPoints = buildPoints(
        secondaryValues,
        xPositions,
        secondaryDomainForPlot,
        secondaryMetric?.invert
      );

      return {
        samples: sorted,
        xPositions,
        xValues,
        primaryValues,
        secondaryValues,
        primaryDomain,
        secondaryDomain,
        primaryPoints,
        secondaryPoints,
        shareAxis,
      };
    }, [samples, primaryMetric, secondaryMetric, xAxis]);

    if (!chartModel || !primaryMetric) {
      return (
        <div className="run-chart run-chart--empty">
          <div className="run-chart__empty">Run data unavailable.</div>
        </div>
      );
    }

    const primaryHasData = chartModel.primaryValues.some((value) => value !== null);
    const secondaryHasData = secondaryMetric
      ? chartModel.secondaryValues.some((value) => value !== null)
      : false;

    const shareAxis = chartModel.shareAxis;

    const displaySecondaryAxis = secondaryMetric && !shareAxis;

    const handleMouseMove = (event: MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const xPositions = chartModel.xPositions;
      let nearestIndex = 0;
      let minDistance = Infinity;
      xPositions.forEach((pos, index) => {
        const distance = Math.abs(pos - x);
        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = index;
        }
      });
      setHoveredIndex(nearestIndex);
    };

    const handleMouseLeave = () => {
      setHoveredIndex(null);
    };

    const tooltipData =
      hoveredIndex !== null
        ? {
            index: hoveredIndex,
            x: chartModel.xPositions[hoveredIndex],
            primary: chartModel.primaryValues[hoveredIndex],
            secondary: chartModel.secondaryValues[hoveredIndex],
            label:
              xAxis === 'distance'
                ? `${chartModel.xValues[hoveredIndex].toFixed(2)} km`
                : formatElapsedTime(chartModel.xValues[hoveredIndex]),
          }
        : null;

    const tooltipLeft = tooltipData
      ? clamp(tooltipData.x, PADDING.left + 40, WIDTH - PADDING.right - 40)
      : 0;
    const tooltipPoint = tooltipData
      ? (chartModel.primaryPoints[tooltipData.index] || chartModel.secondaryPoints[tooltipData.index])
      : null;
    const tooltipTop = tooltipPoint
      ? clamp(tooltipPoint.y - 60, 12, HEIGHT - 120)
      : 12;

    const primarySegments = buildSegments(chartModel.primaryPoints);
    const secondarySegments = buildSegments(
      (shareAxis ? chartModel.secondaryPoints : chartModel.secondaryPoints) as Array<ChartPoint | null>
    );

    const primaryTicks = buildTicks(chartModel.primaryDomain);
    const secondaryTicks = buildTicks(chartModel.secondaryDomain);

    return (
      <div className="run-chart">
        {!primaryHasData && (
          <div className="run-chart__notice">
            {primaryMetric.label} data is unavailable for this run.
          </div>
        )}
        {secondaryMetric && !secondaryHasData && (
          <div className="run-chart__notice run-chart__notice--secondary">
            {secondaryMetric.label} data is unavailable for this run.
          </div>
        )}

        <div className="run-chart__canvas">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="none" />

            <line
              x1={PADDING.left}
              y1={HEIGHT - PADDING.bottom}
              x2={WIDTH - PADDING.right}
              y2={HEIGHT - PADDING.bottom}
              stroke="rgba(148, 163, 184, 0.35)"
              strokeWidth={1}
            />

            {primaryTicks.map((tick) => {
              const ratio =
                chartModel.primaryDomain.max === chartModel.primaryDomain.min
                  ? 0.5
                  : (tick - chartModel.primaryDomain.min) /
                    (chartModel.primaryDomain.max - chartModel.primaryDomain.min);
              const y = primaryMetric.invert
                ? PADDING.top + ratio * (HEIGHT - PADDING.top - PADDING.bottom)
                : PADDING.top + (1 - ratio) * (HEIGHT - PADDING.top - PADDING.bottom);
              return (
                <g key={`primary-tick-${tick}`}>
                  <line
                    x1={PADDING.left}
                    y1={y}
                    x2={WIDTH - PADDING.right}
                    y2={y}
                    stroke="rgba(148, 163, 184, 0.12)"
                    strokeWidth={1}
                  />
                  <text
                    x={PADDING.left - 8}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill="rgba(226, 232, 240, 0.6)"
                  >
                    {primaryMetric.format(tick)}
                  </text>
                </g>
              );
            })}

            {displaySecondaryAxis &&
              secondaryMetric &&
              secondaryTicks.map((tick) => {
                const ratio =
                  chartModel.secondaryDomain.max === chartModel.secondaryDomain.min
                    ? 0.5
                    : (tick - chartModel.secondaryDomain.min) /
                      (chartModel.secondaryDomain.max - chartModel.secondaryDomain.min);
                const y = secondaryMetric.invert
                  ? PADDING.top + ratio * (HEIGHT - PADDING.top - PADDING.bottom)
                  : PADDING.top + (1 - ratio) * (HEIGHT - PADDING.top - PADDING.bottom);
                return (
                  <text
                    key={`secondary-tick-${tick}`}
                    x={WIDTH - PADDING.right + 8}
                    y={y + 4}
                    textAnchor="start"
                    fontSize="11"
                    fill="rgba(226, 232, 240, 0.6)"
                  >
                    {secondaryMetric.format(tick)}
                  </text>
                );
              })}

            {primarySegments.map((segment, index) => (
              <path
                key={`primary-path-${index}`}
                d={buildSmoothPath(segment)}
                fill="none"
                stroke={primaryMetric.color}
                strokeWidth={2.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {secondaryMetric &&
              secondarySegments.map((segment, index) => (
                <path
                  key={`secondary-path-${index}`}
                  d={buildSmoothPath(segment)}
                  fill="none"
                  stroke={secondaryMetric.color}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={secondaryHasData ? 0.85 : 0.3}
                />
              ))}
          </svg>

          {tooltipData && primaryMetric && (
            <div className="run-chart__tooltip" style={{ left: tooltipLeft, top: tooltipTop }}>
              <div className="run-chart__tooltip-title">{tooltipData.label}</div>
              <div className="run-chart__tooltip-row">
                <span className="run-chart__tooltip-dot" style={{ backgroundColor: primaryMetric.color }} />
                <span>{primaryMetric.label}</span>
                <span>{formatMetricValue(primaryMetric, tooltipData.primary)}</span>
              </div>
              {secondaryMetric && (
                <div className="run-chart__tooltip-row">
                  <span className="run-chart__tooltip-dot" style={{ backgroundColor: secondaryMetric.color }} />
                  <span>{secondaryMetric.label}</span>
                  <span>{formatMetricValue(secondaryMetric, tooltipData.secondary)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="run-chart__axis-labels">
          <span className="run-chart__axis-label">{primaryMetric.label}</span>
          {secondaryMetric && (
            <span className="run-chart__axis-label run-chart__axis-label--secondary">
              {secondaryMetric.label}
            </span>
          )}
        </div>
      </div>
    );
  }
);

RunCompareChart.displayName = 'RunCompareChart';
