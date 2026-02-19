/**
 * Chart Normalization Utilities
 * Handles normalization of metrics for dual-axis comparison charts
 * OPTIMIZATION: Added early returns and cached calculations
 */

import type { NormalizedSeries } from '../types/chart.types';

/**
 * Normalize data to 0-100 scale for relative comparison
 * Special handling for pace metrics (min/km) - inverts so faster = higher
 * OPTIMIZATION: Early returns for edge cases, single-pass min/max calculation
 */
export const normalizeData = (
  data: number[],
  unit: string
): { normalized: number[]; min: number; max: number } => {
  // OPTIMIZATION: Early return for empty data
  if (data.length === 0) {
    return { normalized: [], min: 0, max: 0 };
  }

  // OPTIMIZATION: Early return for single value (no normalization needed)
  if (data.length === 1) {
    return { normalized: [50], min: data[0], max: data[0] };
  }

  // OPTIMIZATION: Single-pass min/max calculation instead of two array iterations
  let min = data[0];
  let max = data[0];
  for (let i = 1; i < data.length; i++) {
    const value = data[i];
    if (value < min) min = value;
    if (value > max) max = value;
  }

  // OPTIMIZATION: Early return when all values are the same (no normalization needed)
  if (min === max) {
    return {
      normalized: new Array(data.length).fill(50),
      min,
      max,
    };
  }

  // OPTIMIZATION: Pre-calculate values used in loop
  const isPace = unit === 'min/km';
  const range = max - min;
  const rangeInverse = 100 / range; // Multiply is faster than divide

  // OPTIMIZATION: Use pre-allocated array and direct assignment
  const normalized = new Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const ratio = (data[i] - min) * rangeInverse;
    // For pace, invert the scale (faster pace = lower number = higher on chart)
    normalized[i] = isPace ? (100 - ratio) : ratio;
  }

  return { normalized, min, max };
};

/**
 * Create a normalized series from raw data
 * OPTIMIZATION: Skip normalization for single data point
 */
export const createNormalizedSeries = (
  label: string,
  data: number[],
  unit: string,
  color: string
): NormalizedSeries => {
  // OPTIMIZATION: Early return for empty data
  if (data.length === 0) {
    return {
      label,
      data: [],
      rawData: [],
      unit,
      color,
      min: 0,
      max: 0,
    };
  }

  // OPTIMIZATION: For single data point, skip normalization entirely
  if (data.length === 1) {
    return {
      label,
      data: [50], // Center single point
      rawData: data,
      unit,
      color,
      min: data[0],
      max: data[0],
    };
  }

  // Perform normalization for multiple data points
  const { normalized, min, max } = normalizeData(data, unit);

  return {
    label,
    data: normalized,
    rawData: data,
    unit,
    color,
    min,
    max,
  };
};

/**
 * Format a value for display based on its unit
 * OPTIMIZATION: Early return for invalid values, optimized string operations
 */
export const formatValue = (value: number, unit: string): string => {
  // OPTIMIZATION: Early return for invalid values
  if (!Number.isFinite(value)) return '';

  // OPTIMIZATION: Use switch for better performance with multiple conditions
  switch (unit) {
    case 'min/km': {
      const minutes = Math.floor(value);
      const seconds = Math.round((value - minutes) * 60);
      // OPTIMIZATION: Use template literal for faster string concatenation
      return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }
    
    case 'km':
      return value.toFixed(1);
    
    case 'bpm':
    case 'spm':
      return Math.round(value).toString();
    
    default:
      return value.toFixed(0);
  }
};

/**
 * Clamp a value between min and max
 * OPTIMIZATION: Inline for better performance (already optimal)
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

/**
 * Build SVG path from points
 * OPTIMIZATION: Use array join instead of reduce for better performance
 */
export const buildPath = (points: Array<{ x: number; y: number }>): string => {
  // OPTIMIZATION: Early return for empty array
  if (points.length === 0) return '';
  
  // OPTIMIZATION: Pre-allocate array and use join (faster than string concatenation)
  const pathParts = new Array(points.length);
  pathParts[0] = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 1; i < points.length; i++) {
    pathParts[i] = `L ${points[i].x} ${points[i].y}`;
  }
  
  return pathParts.join(' ');
};

// Made with Bob