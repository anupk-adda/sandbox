import { memo, useMemo } from 'react';
import type { Chart } from '../../../services/chatService';
import { inferChartVariant } from './chartModel';
import { EmptyState } from './EmptyState';
import { SingleRunChartCard } from './SingleRunChartCard';
import { TrendCompareChartCard } from './TrendCompareChartCard';

type GraphWidgetProps = {
  charts?: Chart[];
};

export const GraphWidget = memo(({ charts }: GraphWidgetProps) => {
  const variant = useMemo(() => inferChartVariant(charts), [charts]);

  if (!charts || charts.length === 0) {
    return null;
  }

  if (variant === 'single_run') {
    return <SingleRunChartCard charts={charts} />;
  }

  if (variant === 'trend_compare') {
    return <TrendCompareChartCard charts={charts} />;
  }

  return (
    <div className="chart-list graph-widget">
      <div className="graph-card">
        <div className="graph-card-title">Run Data</div>
        <EmptyState />
      </div>
    </div>
  );
});

GraphWidget.displayName = 'GraphWidget';
