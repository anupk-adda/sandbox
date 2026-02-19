import { memo } from 'react';
import type { Chart } from '../services/chatService';
import { GraphWidget } from './graphs/v2/GraphWidget';

type ChartsProps = {
  charts?: Chart[];
};

export const Charts = memo(({ charts }: ChartsProps) => {
  return <GraphWidget charts={charts} />;
});

Charts.displayName = 'Charts';
