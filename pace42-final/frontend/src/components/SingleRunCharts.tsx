/**
 * Single Run Charts Component
 * Displays detailed charts for a single run analysis (HR zones, splits, pace over time)
 */

import { memo } from 'react';
import type { Chart } from '../services/chatService';

type SingleRunChartsProps = {
  charts: Chart[];
};

/**
 * Optimized single run chart renderer
 * Uses memo to prevent unnecessary re-renders
 */
export const SingleRunCharts = memo(({ charts }: SingleRunChartsProps) => {
  if (!charts || charts.length === 0) {
    return null;
  }

  return (
    <div className="chart-list">
      {charts.map((chart) => (
        <SingleRunChart key={chart.id} chart={chart} />
      ))}
    </div>
  );
});

SingleRunCharts.displayName = 'SingleRunCharts';

/**
 * Individual chart component with memo optimization
 */
const SingleRunChart = memo(({ chart }: { chart: Chart }) => {
  const width = 560;
  const height = 240;
  const padding = 40;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  // Calculate points for each series
  const calculatePoints = (data: number[], min: number, max: number) => {
    const xStep = chart.xLabels.length > 1 
      ? innerWidth / (chart.xLabels.length - 1) 
      : innerWidth;

    return data.map((value, index) => {
      const x = padding + index * xStep;
      const ratio = max === min ? 0.5 : (value - min) / (max - min);
      const y = padding + (1 - Math.max(0, Math.min(1, ratio))) * innerHeight;
      return { x, y, value };
    });
  };

  // Build SVG path from points
  const buildPath = (points: { x: number; y: number }[]) => {
    if (points.length === 0) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  };

  // Format value based on unit
  const formatValue = (value: number, unit?: string) => {
    if (!unit) return value.toFixed(1);
    
    if (unit.includes('min/km') || unit.includes('pace')) {
      const minutes = Math.floor(value);
      const seconds = Math.round((value - minutes) * 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    if (unit.includes('bpm') || unit.includes('spm')) {
      return Math.round(value).toString();
    }
    
    return value.toFixed(1);
  };

  return (
    <div className="chart-card">
      <div className="chart-title">{chart.title}</div>
      <svg width={width} height={height} role="img" aria-label={chart.title}>
        {/* Background */}
        <rect x={0} y={0} width={width} height={height} fill="none" />

        {/* Axes */}
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#e5e7eb"
          strokeWidth={1}
        />
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke="#e5e7eb"
          strokeWidth={1}
        />

        {/* Render each series */}
        {chart.series.map((series, seriesIndex) => {
          const data = series.data;
          const min = Math.min(...data);
          const max = Math.max(...data);
          const points = calculatePoints(data, min, max);
          const color = series.color || (seriesIndex === 0 ? '#4f46e5' : '#f97316');
          
          const xStep = chart.xLabels.length > 1 
            ? innerWidth / (chart.xLabels.length - 1) 
            : innerWidth;
          
          // Area path
          const areaPath = `${buildPath(points)} L ${padding + (points.length - 1) * xStep} ${height - padding} L ${padding} ${height - padding} Z`;

          return (
            <g key={`series-${seriesIndex}`}>
              {/* Area fill */}
              <path d={areaPath} fill={`${color}22`} stroke="none" />
              
              {/* Line */}
              <path
                d={buildPath(points)}
                fill="none"
                stroke={color}
                strokeWidth={2}
              />
              
              {/* Points and labels */}
              {points.map((point, index) => (
                <g key={`point-${seriesIndex}-${index}`}>
                  <circle cx={point.x} cy={point.y} r={3} fill={color} />
                  <text
                    x={point.x}
                    y={point.y - 10}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#475569"
                  >
                    {formatValue(point.value, series.unit || chart.yLabel)}
                  </text>
                </g>
              ))}
            </g>
          );
        })}

        {/* X-axis labels */}
        {chart.xLabels.map((label, index) => {
          const xStep = chart.xLabels.length > 1 
            ? innerWidth / (chart.xLabels.length - 1) 
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

        {/* Y-axis label */}
        {chart.yLabel && (
          <text
            x={padding}
            y={padding - 10}
            fontSize="11"
            fill="#4f46e5"
          >
            {chart.yLabel}
          </text>
        )}

        {/* Legend */}
        {chart.series.length > 1 && (
          <g>
            {chart.series.map((series, index) => {
              const color = series.color || (index === 0 ? '#4f46e5' : '#f97316');
              const legendX = width - padding - 100;
              const legendY = padding + index * 20;
              
              return (
                <g key={`legend-${index}`}>
                  <rect
                    x={legendX}
                    y={legendY - 8}
                    width={12}
                    height={12}
                    fill={color}
                  />
                  <text
                    x={legendX + 16}
                    y={legendY + 2}
                    fontSize="10"
                    fill="#475569"
                  >
                    {series.label}
                  </text>
                </g>
              );
            })}
          </g>
        )}
      </svg>
      
      {/* Chart note */}
      {chart.note && (
        <div className="chart-note">{chart.note}</div>
      )}
    </div>
  );
});

SingleRunChart.displayName = 'SingleRunChart';

// Made with Bob
