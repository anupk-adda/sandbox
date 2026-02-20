import { memo } from 'react';
import type { MetricDefinition, MetricId } from './runAnalysisUtils';

type MetricPickerProps = {
  label: string;
  value: MetricId | '';
  options: MetricDefinition[];
  onChange: (next: MetricId | '') => void;
  allowNone?: boolean;
};

export const MetricPicker = memo(
  ({ label, value, options, onChange, allowNone }: MetricPickerProps) => {
    return (
      <label className="metric-picker">
        <span className="metric-picker__label">{label}</span>
        <select
          className="metric-picker__select"
          value={value}
          onChange={(event) => onChange(event.target.value as MetricId | '')}
        >
          {allowNone && <option value="">None</option>}
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
);

MetricPicker.displayName = 'MetricPicker';
