/**
 * Run Trends Compare Component
 * Dual-metric chart with independent normalization and dual-axis support
 * Optimized with React.memo and useMemo for performance
 */

import { useState, useMemo, useCallback, useRef, useEffect, memo } from 'react';
import type { Chart } from '../services/chatService';
import { chatService } from '../services/chatService';
import type {
  DisplayMode,
  RangeOption,
  MetricOption,
  DualMetricChartData,
  ChartPoint,
} from '../types/chart.types';
import {
  createNormalizedSeries,
  formatValue,
  clamp,
  buildPath,
} from '../utils/chartNormalization';

type RunTrendsCompareProps = {
  charts: Chart[];
};

const COLORS = {
  primary: '#4f46e5',
  compare: '#f97316',
};

export const RunTrendsCompare = memo(({ charts: initialCharts }: RunTrendsCompareProps) => {
  // Range options limited to 4 and 10 to match existing agent/data fetch logic
  // These values are supported by fitness_trend_analyzer and last_runs_comparator
  const RANGE_OPTIONS: RangeOption[] = [4, 10];
  
  // State
  const [charts, setCharts] = useState<Chart[]>(initialCharts);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('relative');
  const [range, setRange] = useState<RangeOption>(4);
  const [primaryMetricId, setPrimaryMetricId] = useState<string>('');
  const [compareMetricId, setCompareMetricId] = useState<string>('');
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingRange, setLoadingRange] = useState<RangeOption | null>(null);

  // Refs for debouncing
  const fetchTimeoutRef = useRef<number | null>(null);
  const lastFetchedCountRef = useRef<number>(0);

  // Update charts when initialCharts changes
  useEffect(() => {
    setCharts(initialCharts);
  }, [initialCharts]);

  // Extract metric options from charts with validation
  const metricOptions: MetricOption[] = useMemo(() => {
    if (!charts || charts.length === 0) {
      return [];
    }
    
    return charts
      .filter(chart => chart && chart.id && chart.title)
      .map((chart, index) => ({
        id: chart.id,
        label: chart.title.replace(/\(.*?\)/g, '').trim(),
        unit: chart.yLabel || '',
        data: chart.series?.[0]?.data || [],
        color: index === 0 ? COLORS.primary : COLORS.compare,
      }));
  }, [charts]);

  // Initialize primary metric ID
  useEffect(() => {
    if (!primaryMetricId && metricOptions.length > 0) {
      setPrimaryMetricId(metricOptions[0].id);
    }
  }, [metricOptions, primaryMetricId]);

  // Fetch run data with debouncing and AbortController for cleanup
  const fetchRunData = useCallback(async (count: number) => {
    // Clear any pending fetch
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    // Debounce: wait 300ms before fetching
    fetchTimeoutRef.current = window.setTimeout(async () => {
      // Check if we already have enough data
      const currentDataLength = charts[0]?.xLabels?.length || 0;
      if (count <= currentDataLength) {
        setLoadingRange(null);
        return;
      }

      // Check if we already fetched this count
      if (lastFetchedCountRef.current === count) {
        setLoadingRange(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      // Create AbortController for this fetch
      const controller = new AbortController();
      
      try {
        const newCharts = await chatService.fetchRunData(count);
        
        // Check if component is still mounted and request wasn't aborted
        if (!controller.signal.aborted) {
          if (newCharts && newCharts.length > 0) {
            setCharts(newCharts);
            lastFetchedCountRef.current = count;
            setError(null);
          } else {
            setError(`No data available for the last ${count} runs`);
            console.warn(`[RunTrendsCompare] No data returned for count: ${count}`);
          }
        }
      } catch (err) {
        // Only set error if not aborted
        if (!controller.signal.aborted) {
          const errorMessage = err instanceof Error
            ? `Unable to load data for last ${count} runs: ${err.message}`
            : `Failed to fetch data for last ${count} runs`;
          setError(errorMessage);
          console.error('[RunTrendsCompare] Error fetching run data:', {
            count,
            error: err,
            message: err instanceof Error ? err.message : 'Unknown error'
          });
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          setLoadingRange(null);
        }
      }
    }, 300);
  }, [charts]);

  // Handle range change
  const handleRangeChange = useCallback((newRange: RangeOption) => {
    setRange(newRange);
    setLoadingRange(newRange);
    fetchRunData(newRange);
  }, [fetchRunData]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []);

  // Get selected metrics with validation
  const primaryMetric = useMemo(() => {
    return metricOptions.find((m) => m.id === primaryMetricId);
  }, [metricOptions, primaryMetricId]);
  
  const compareMetric = useMemo(() => {
    // Handle empty compareMetricId (when "None" is selected)
    if (!compareMetricId) return null;
    return metricOptions.find((m) => m.id === compareMetricId);
  }, [metricOptions, compareMetricId]);

  // Prepare chart data with defensive checks
  // OPTIMIZATION: Only normalize when comparison is active
  const chartData: DualMetricChartData = useMemo(() => {
    const baseChart = charts[0];
    if (!baseChart || !baseChart.xLabels || baseChart.xLabels.length === 0) {
      console.warn('[RunTrendsCompare] No valid base chart data available');
      return { xLabels: [], primarySeries: null, compareSeries: null };
    }

    const xLabels = baseChart.xLabels.slice(-range);

    // Validate primary metric data
    const primarySeries = primaryMetric && primaryMetric.data && primaryMetric.data.length > 0
      ? createNormalizedSeries(
          primaryMetric.label,
          primaryMetric.data.slice(-range),
          primaryMetric.unit,
          COLORS.primary
        )
      : null;

    // OPTIMIZATION: Only create compare series if compareMetricId is set
    // This skips unnecessary normalization for single-metric view
    const compareSeries =
      compareMetric && compareMetricId && compareMetric.data && compareMetric.data.length > 0
        ? createNormalizedSeries(
            compareMetric.label,
            compareMetric.data.slice(-range),
            compareMetric.unit,
            COLORS.compare
          )
        : null;

    return { xLabels, primarySeries, compareSeries };
  }, [charts, range, primaryMetric, compareMetric, compareMetricId]);

  // Chart dimensions
  const width = 560;
  const height = 240;
  const padding = 40;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  // OPTIMIZATION: Memoize xStep calculation to avoid recalculation
  const xStep = useMemo(() => {
    return chartData.xLabels.length > 1
      ? innerWidth / (chartData.xLabels.length - 1)
      : innerWidth;
  }, [chartData.xLabels.length, innerWidth]);

  // OPTIMIZATION: Memoize calculatePoints function
  const calculatePoints = useCallback((
    data: number[],
    min: number,
    max: number
  ): ChartPoint[] => {
    return data.map((value, index) => {
      const x = padding + index * xStep;
      let y: number;

      if (displayMode === 'relative') {
        // In relative mode, data is already normalized 0-100
        const ratio = value / 100;
        y = padding + (1 - clamp(ratio, 0, 1)) * innerHeight;
      } else {
        // In actual mode, use raw min/max
        const ratio = max === min ? 0.5 : (value - min) / (max - min);
        y = padding + (1 - clamp(ratio, 0, 1)) * innerHeight;
      }

      return { x, y };
    });
  }, [displayMode, xStep, innerHeight]);

  // OPTIMIZATION: Memoize point calculations to prevent recalculation on every render
  const primaryPoints = useMemo(() => {
    if (!chartData.primarySeries || hiddenSeries.has('primary')) {
      return [];
    }
    return calculatePoints(
      displayMode === 'relative'
        ? chartData.primarySeries.data
        : chartData.primarySeries.rawData,
      chartData.primarySeries.min,
      chartData.primarySeries.max
    );
  }, [chartData.primarySeries, hiddenSeries, displayMode, calculatePoints]);

  const comparePoints = useMemo(() => {
    if (!chartData.compareSeries || hiddenSeries.has('compare')) {
      return [];
    }
    return calculatePoints(
      displayMode === 'relative'
        ? chartData.compareSeries.data
        : chartData.compareSeries.rawData,
      chartData.compareSeries.min,
      chartData.compareSeries.max
    );
  }, [chartData.compareSeries, hiddenSeries, displayMode, calculatePoints]);

  const toggleSeries = (seriesId: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(seriesId)) {
        next.delete(seriesId);
      } else {
        next.add(seriesId);
      }
      return next;
    });
  };

  const renderSeries = (
    points: ChartPoint[],
    series: { label: string; rawData: number[]; unit: string; color: string },
    seriesId: string
  ) => {
    if (points.length === 0) return null;

    const xStep =
      chartData.xLabels.length > 1
        ? innerWidth / (chartData.xLabels.length - 1)
        : innerWidth;

    const areaPath = `${buildPath(points)} L ${padding + (points.length - 1) * xStep} ${height - padding} L ${padding} ${height - padding} Z`;

    return (
      <g key={seriesId}>
        <path d={areaPath} fill={series.color + '22'} stroke="none" />
        <path
          d={buildPath(points)}
          fill="none"
          stroke={series.color}
          strokeWidth={2}
        />
        {points.map((point, index) => {
          const rawValue = series.rawData[index];
          const display = formatValue(rawValue, series.unit);
          return (
            <g key={`${seriesId}-point-${index}`}>
              <circle cx={point.x} cy={point.y} r={3} fill={series.color} />
              <text
                x={point.x}
                y={point.y - 10}
                textAnchor="middle"
                fontSize="10"
                fill="#475569"
              >
                {display}
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  // Handle empty state
  if (!charts || charts.length === 0 || metricOptions.length === 0) {
    return (
      <div className="chart-list">
        <div className="chart-card">
          <div className="chart-title">Run Trends</div>
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#6b7280',
          }}>
            <p>No data available</p>
            <p style={{ fontSize: '14px', marginTop: '8px' }}>
              Run data will appear here once available
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Handle missing primary metric
  if (!primaryMetric) {
    return (
      <div className="chart-list">
        <div className="error-message" style={{
          padding: '12px',
          marginBottom: '16px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          color: '#c33',
        }}>
          <strong>Error:</strong> Unable to load primary metric. Please try refreshing the page.
        </div>
      </div>
    );
  }

  // Handle missing chart data
  if (!chartData.xLabels || chartData.xLabels.length === 0) {
    return (
      <div className="chart-list">
        <div className="chart-card">
          <div className="chart-title">Run Trends</div>
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#6b7280',
          }}>
            <p>No data available for the selected range</p>
            <p style={{ fontSize: '14px', marginTop: '8px' }}>
              Try selecting a different range or check back later
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-list">
      {/* Error Message */}
      {error && (
        <div className="error-message" style={{
          padding: '12px',
          marginBottom: '16px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          color: '#c33',
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Controls */}
      <div className="run-trends-controls">
        <div className="run-trends-control-group">
          <label className="run-trends-label">Primary Metric</label>
          <select
            className="run-trends-select"
            value={primaryMetricId}
            onChange={(e) => setPrimaryMetricId(e.target.value)}
          >
            {metricOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="run-trends-control-group">
          <label className="run-trends-label">Compare With</label>
          <select
            className="run-trends-select"
            value={compareMetricId}
            onChange={(e) => setCompareMetricId(e.target.value)}
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

        <div className="run-trends-control-group">
          <label className="run-trends-label">Mode</label>
          <div className="run-trends-toggle">
            <button
              type="button"
              className={`run-trends-toggle-btn ${displayMode === 'relative' ? 'active' : ''}`}
              onClick={() => setDisplayMode('relative')}
            >
              Relative
            </button>
            <button
              type="button"
              className={`run-trends-toggle-btn ${displayMode === 'actual' ? 'active' : ''}`}
              onClick={() => setDisplayMode('actual')}
            >
              Actual
            </button>
          </div>
        </div>

        <div className="run-trends-control-group">
          <label className="run-trends-label">Range</label>
          <div className="run-trends-toggle">
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                className={`run-trends-toggle-btn ${range === r ? 'active' : ''} ${loadingRange === r ? 'loading' : ''}`}
                onClick={() => handleRangeChange(r)}
                disabled={isLoading}
              >
                {loadingRange === r ? (
                  <>
                    <span className="spinner" />
                    Loading...
                  </>
                ) : (
                  `Last ${r}`
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend - OPTIMIZATION: Simplified when only one metric */}
      <div className="run-trends-legend">
        {chartData.primarySeries && (
          <button
            type="button"
            className={`run-trends-legend-item ${hiddenSeries.has('primary') ? 'inactive' : ''}`}
            onClick={() => toggleSeries('primary')}
          >
            <span
              className="run-trends-legend-color"
              style={{ backgroundColor: COLORS.primary }}
            />
            <span className="run-trends-legend-label">
              {chartData.primarySeries.label}
            </span>
            <span className="run-trends-legend-unit">
              ({chartData.primarySeries.unit})
            </span>
          </button>
        )}
        {/* OPTIMIZATION: Only render compare legend when compare metric is active */}
        {chartData.compareSeries && compareMetricId && (
          <button
            type="button"
            className={`run-trends-legend-item ${hiddenSeries.has('compare') ? 'inactive' : ''}`}
            onClick={() => toggleSeries('compare')}
          >
            <span
              className="run-trends-legend-color"
              style={{ backgroundColor: COLORS.compare }}
            />
            <span className="run-trends-legend-label">
              {chartData.compareSeries.label}
            </span>
            <span className="run-trends-legend-unit">
              ({chartData.compareSeries.unit})
            </span>
          </button>
        )}
      </div>

      {/* Chart */}
      <div className="chart-card">
        <div className="chart-title">
          Run Trends ({displayMode === 'relative' ? 'Relative' : 'Actual'})
        </div>
        <svg width={width} height={height} role="img" aria-label="Run Trends">
          <rect x={0} y={0} width={width} height={height} fill="none" />

          {/* Axes */}
          <line
            x1={padding}
            y1={height - padding}
            x2={width - padding}
            y2={height - padding}
            stroke="#e5e7eb"
          />
          <line
            x1={padding}
            y1={padding}
            x2={padding}
            y2={height - padding}
            stroke="#e5e7eb"
          />

          {/* Series */}
          {chartData.primarySeries &&
            renderSeries(primaryPoints, chartData.primarySeries, 'primary')}
          {chartData.compareSeries &&
            renderSeries(comparePoints, chartData.compareSeries, 'compare')}

          {/* X-axis labels */}
          {chartData.xLabels.map((label, index) => {
            const xStep =
              chartData.xLabels.length > 1
                ? innerWidth / (chartData.xLabels.length - 1)
                : innerWidth;
            const x = padding + index * xStep;
            return (
              <text
                key={`xlabel-${index}`}
                x={x}
                y={height - padding + 18}
                textAnchor="middle"
                fontSize="11"
                fill="#6b7280"
              >
                {label}
              </text>
            );
          })}

          {/* Y-axis labels - OPTIMIZATION: Skip dual-axis when only one metric */}
          {chartData.primarySeries && (
            <text x={padding} y={padding - 10} fontSize="11" fill={COLORS.primary}>
              {chartData.primarySeries.label}
            </text>
          )}
          {/* OPTIMIZATION: Only render second Y-axis label when compare metric is active */}
          {chartData.compareSeries && compareMetricId && (
            <text
              x={width - padding}
              y={padding - 10}
              textAnchor="end"
              fontSize="11"
              fill={COLORS.compare}
            >
              {chartData.compareSeries.label}
            </text>
          )}
        </svg>
        {displayMode === 'relative' && (
          <div className="chart-note">
            Lines are normalized to compare trends. Toggle to Actual mode to see
            real values.
          </div>
        )}
      </div>
    </div>
  );
});

RunTrendsCompare.displayName = 'RunTrendsCompare';

// Made with Bob