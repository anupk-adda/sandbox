import { memo, useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  clamp,
  formatElapsedTime,
  formatMetricValue,
  getMetricDefinition,
  getMetricValue,
  getNormalizedValue,
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
  top: 20,
  bottom: 32,
  left: 52,
  right: 52,
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

const buildAreaPath = (points: ChartPoint[]) => {
  if (points.length < 2) return '';
  const bottom = HEIGHT - PADDING.bottom;
  const path = buildSmoothPath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${path} L ${last.x} ${bottom} L ${first.x} ${bottom} Z`;
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
  return samples.map((sample) => getMetricValue(sample, metric));
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

const computeMedian = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

const despikeSeries = (values: Array<number | null>) => {
  const numeric = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (numeric.length < 6) return values;
  const median = computeMedian(numeric);
  const deviations = numeric.map((value) => Math.abs(value - median));
  const mad = computeMedian(deviations) || 1;
  const threshold = mad * 4;
  let lastValid = median;
  return values.map((value) => {
    if (value === null || !Number.isFinite(value)) return value;
    if (Math.abs(value - median) > threshold) {
      return lastValid;
    }
    lastValid = value;
    return value;
  });
};

const smoothSeries = (values: Array<number | null>, windowSize: number) => {
  if (windowSize <= 1) return values;
  const half = Math.floor(windowSize / 2);
  return values.map((value, index) => {
    if (value === null || !Number.isFinite(value)) return null;
    let sum = 0;
    let count = 0;
    for (let i = index - half; i <= index + half; i += 1) {
      const sample = values[i];
      if (sample === null || !Number.isFinite(sample)) continue;
      sum += sample;
      count += 1;
    }
    return count ? sum / count : value;
  });
};

const normalizeSeries = (values: Array<number | null>, metric: MetricDefinition) => {
  const normalized = values.map((value) => getNormalizedValue(value, metric));
  const numeric = normalized.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!numeric.length) return normalized;
  const max = Math.max(...numeric);
  if (!Number.isFinite(max) || max === 0) return normalized;
  return normalized.map((value) => (value === null ? null : (value / max) * 100));
};

const consolidateSamples = (samples: RunSample[], xAxis: 'time' | 'distance') => {
  const grouped = new Map<number, RunSample[]>();
  samples.forEach((sample) => {
    const xValue = xAxis === 'distance'
      ? Number(sample.distanceKm.toFixed(2))
      : Math.round(new Date(sample.timestamp).getTime() / 1000);
    if (!grouped.has(xValue)) grouped.set(xValue, []);
    grouped.get(xValue)?.push(sample);
  });

  const consolidated: RunSample[] = [];
  grouped.forEach((groupSamples, xValue) => {
    const base = groupSamples[0];
    const metrics: Record<string, number | null> = {};
    const metricKeys = Object.keys(base.metrics || {});
    metricKeys.forEach((key) => {
      const values = groupSamples
        .map((sample) => sample.metrics[key as MetricId])
        .filter((value): value is number => Number.isFinite(value as number));
      metrics[key] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    });
    consolidated.push({
      timestamp: xAxis === 'distance' ? base.timestamp : new Date(xValue * 1000).toISOString(),
      distanceKm: xAxis === 'distance' ? xValue : base.distanceKm,
      metrics,
    });
  });

  return consolidated.sort((a, b) => {
    const left = xAxis === 'distance'
      ? a.distanceKm
      : new Date(a.timestamp).getTime();
    const right = xAxis === 'distance'
      ? b.distanceKm
      : new Date(b.timestamp).getTime();
    return left - right;
  });
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

      const sorted = consolidateSamples(samples, xAxis);

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

      const rawPrimaryValues = extractValues(sorted, primaryMetric);
      const rawSecondaryValues = extractValues(sorted, secondaryMetric);
      const efficiencyMetric = getMetricDefinition('efficiencyIndex');
      const rawEfficiencyValues = efficiencyMetric ? extractValues(sorted, efficiencyMetric) : [];
      const hrMetric = getMetricDefinition('heartRate');
      const paceMetric = getMetricDefinition('pace');
      const rawHrValues = hrMetric ? extractValues(sorted, hrMetric) : [];
      const rawPaceValues = paceMetric ? extractValues(sorted, paceMetric) : [];

      const timestamps = sorted.map((sample) => new Date(sample.timestamp).getTime());
      const deltas = timestamps
        .slice(1)
        .map((time, index) => Math.abs(time - timestamps[index]) / 1000)
        .filter((delta) => Number.isFinite(delta) && delta > 0);
      const medianDelta = deltas.length ? computeMedian(deltas) : 15;
      const windowSize = Math.max(1, Math.round(15 / Math.max(medianDelta, 1)));

      const primaryValues = smoothSeries(despikeSeries(rawPrimaryValues), windowSize);
      const secondaryValues = smoothSeries(despikeSeries(rawSecondaryValues), windowSize);
      const efficiencyValues = smoothSeries(despikeSeries(rawEfficiencyValues), windowSize);
      const hrValues = smoothSeries(despikeSeries(rawHrValues), windowSize);
      const paceValues = smoothSeries(despikeSeries(rawPaceValues), windowSize);

      const primaryDomain = computeDomain(primaryValues);
      const secondaryDomain = computeDomain(secondaryValues);
      const shareAxis =
        secondaryMetric &&
        primaryMetric.unit === secondaryMetric.unit &&
        primaryMetric.invert === secondaryMetric.invert;
      const shouldNormalize = Boolean(secondaryMetric && !shareAxis);
      const normalizedPrimary = shouldNormalize ? normalizeSeries(primaryValues, primaryMetric) : primaryValues;
      const normalizedSecondary = shouldNormalize && secondaryMetric
        ? normalizeSeries(secondaryValues, secondaryMetric)
        : secondaryValues;
      const domainForNormalized = { min: 0, max: 100 };

      const primaryPoints = buildPoints(
        normalizedPrimary,
        xPositions,
        shouldNormalize ? domainForNormalized : primaryDomain,
        shouldNormalize ? false : primaryMetric.invert
      );
      const secondaryPoints = buildPoints(
        normalizedSecondary,
        xPositions,
        shouldNormalize ? domainForNormalized : shareAxis ? primaryDomain : secondaryDomain,
        shouldNormalize ? false : secondaryMetric?.invert
      );

      const baselineWindow = Math.max(3, Math.floor((efficiencyValues.length || 0) * 0.2));
      const baselineEfficiency =
        efficiencyValues.slice(0, baselineWindow).filter((value): value is number => value !== null).reduce(
          (sum, value) => sum + value,
          0
        ) / Math.max(1, efficiencyValues.slice(0, baselineWindow).filter((value): value is number => value !== null).length);
      const driftValues = efficiencyValues.map((value) => {
        if (value === null || !Number.isFinite(value) || !baselineEfficiency) return null;
        return ((value - baselineEfficiency) / baselineEfficiency) * 100;
      });

      return {
        samples: sorted,
        xPositions,
        xValues,
        primaryValues,
        secondaryValues,
        efficiencyValues,
        hrValues,
        paceValues,
        driftValues,
        primaryDomain,
        secondaryDomain,
        primaryPoints,
        secondaryPoints,
        shareAxis: shareAxis || shouldNormalize,
        shouldNormalize,
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
    const shouldNormalize = chartModel.shouldNormalize;

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

    const efficiencyMetric = getMetricDefinition('efficiencyIndex');
    const hrMetric = getMetricDefinition('heartRate');
    const paceMetric = getMetricDefinition('pace');
    const showHr = hrMetric && primaryMetricId !== 'heartRate' && secondaryMetricId !== 'heartRate';
    const showPace = paceMetric && primaryMetricId !== 'pace' && secondaryMetricId !== 'pace';
    const tooltipData =
      hoveredIndex !== null
        ? {
            index: hoveredIndex,
            x: chartModel.xPositions[hoveredIndex],
            primary: chartModel.primaryValues[hoveredIndex],
            secondary: chartModel.secondaryValues[hoveredIndex],
            efficiency: chartModel.efficiencyValues[hoveredIndex],
            drift: chartModel.driftValues[hoveredIndex],
            hr: chartModel.hrValues?.[hoveredIndex] ?? null,
            pace: chartModel.paceValues?.[hoveredIndex] ?? null,
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

    const primaryTicks = buildTicks(shouldNormalize ? { min: 0, max: 100 } : chartModel.primaryDomain);
    const secondaryTicks = buildTicks(chartModel.secondaryDomain);
    const primaryAxisInvert = shouldNormalize ? false : primaryMetric.invert;

    const zoneSegments = (() => {
      if (!chartModel.driftValues.length) return [];
      const segments: Array<{ start: number; end: number; zone: 'stable' | 'warn' | 'fade' }> = [];
      let current: { start: number; end: number; zone: 'stable' | 'warn' | 'fade' } | null = null;
      chartModel.driftValues.forEach((value, index) => {
        if (value === null) return;
        const zone = value <= -8 ? 'fade' : value <= -4 ? 'warn' : 'stable';
        if (!current) {
          current = { start: index, end: index, zone };
        } else if (current.zone === zone) {
          current.end = index;
        } else {
          segments.push(current);
          current = { start: index, end: index, zone };
        }
      });
      if (current) segments.push(current);
      return segments;
    })();

    return (
      <div className="run-chart">
        {shouldNormalize && secondaryMetric && (
          <div className="run-chart__normalized">Normalized overlay (% of session max)</div>
        )}
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

            <defs>
              <linearGradient id="hr-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(249, 115, 22, 0.35)" />
                <stop offset="100%" stopColor="rgba(249, 115, 22, 0)" />
              </linearGradient>
            </defs>

            {zoneSegments.map((segment, index) => {
              const startX = chartModel.xPositions[segment.start];
              const endX = chartModel.xPositions[segment.end];
              const width = Math.max(2, endX - startX);
              const fill =
                segment.zone === 'fade'
                  ? 'rgba(239, 68, 68, 0.08)'
                  : segment.zone === 'warn'
                  ? 'rgba(245, 158, 11, 0.08)'
                  : 'rgba(16, 185, 129, 0.05)';
              return (
                <rect
                  key={`zone-${index}`}
                  x={startX}
                  y={PADDING.top}
                  width={width}
                  height={HEIGHT - PADDING.top - PADDING.bottom}
                  fill={fill}
                />
              );
            })}

            <line
              x1={PADDING.left}
              y1={HEIGHT - PADDING.bottom}
              x2={WIDTH - PADDING.right}
              y2={HEIGHT - PADDING.bottom}
              stroke="rgba(148, 163, 184, 0.35)"
              strokeWidth={0.7}
            />

            {primaryTicks.map((tick) => {
              const ratio =
                shouldNormalize || chartModel.primaryDomain.max === chartModel.primaryDomain.min
                  ? 0.5
                  : (tick - chartModel.primaryDomain.min) /
                    (chartModel.primaryDomain.max - chartModel.primaryDomain.min);
              const y = primaryAxisInvert
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
                    strokeWidth={0.6}
                  />
                  <text
                    x={PADDING.left - 8}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill="rgba(226, 232, 240, 0.6)"
                  >
                    {shouldNormalize ? `${Math.round(tick)}%` : primaryMetric.format(tick)}
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

            {primaryMetric.id === 'heartRate' &&
              primarySegments.map((segment, index) => (
                <path
                  key={`primary-area-${index}`}
                  d={buildAreaPath(segment)}
                  fill="url(#hr-area)"
                  stroke="none"
                />
              ))}

            {primarySegments.map((segment, index) => (
              <path
                key={`primary-path-${index}`}
                d={buildSmoothPath(segment)}
                fill="none"
                stroke={primaryMetric.color}
                strokeWidth={2.8}
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
                  strokeWidth={2.4}
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
              {showHr && hrMetric && tooltipData.hr !== null && (
                <div className="run-chart__tooltip-row">
                  <span className="run-chart__tooltip-dot" style={{ backgroundColor: hrMetric.color }} />
                  <span>Heart Rate</span>
                  <span>{formatMetricValue(hrMetric, tooltipData.hr)}</span>
                </div>
              )}
              {showPace && paceMetric && tooltipData.pace !== null && (
                <div className="run-chart__tooltip-row">
                  <span className="run-chart__tooltip-dot" style={{ backgroundColor: paceMetric.color }} />
                  <span>Pace</span>
                  <span>{formatMetricValue(paceMetric, tooltipData.pace)}</span>
                </div>
              )}
              {efficiencyMetric && tooltipData.efficiency !== null && (
                <div className="run-chart__tooltip-row">
                  <span className="run-chart__tooltip-dot" style={{ backgroundColor: efficiencyMetric.color }} />
                  <span>Efficiency</span>
                  <span>{formatMetricValue(efficiencyMetric, tooltipData.efficiency)}</span>
                </div>
              )}
              {tooltipData.drift !== null && tooltipData.drift !== undefined && (
                <div className="run-chart__tooltip-row run-chart__tooltip-row--muted">
                  <span>Drift</span>
                  <span>{`${tooltipData.drift > 0 ? '+' : ''}${tooltipData.drift.toFixed(1)}%`}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="run-chart__axis-labels">
          <span className="run-chart__axis-label">
            {shouldNormalize ? 'Normalized (%)' : primaryMetric.label}
          </span>
          {secondaryMetric && (
            <span className="run-chart__axis-label run-chart__axis-label--secondary">
              {shouldNormalize ? `${primaryMetric.label} vs ${secondaryMetric.label}` : secondaryMetric.label}
            </span>
          )}
        </div>
      </div>
    );
  }
);

RunCompareChart.displayName = 'RunCompareChart';
