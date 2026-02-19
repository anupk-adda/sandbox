import type { ReactNode } from 'react';

type EmptyStateProps = {
  title?: string;
  message?: string;
  action?: ReactNode;
};

export const EmptyState = ({
  title = 'Not enough data',
  message = 'Not enough data to plot this metric.',
  action,
}: EmptyStateProps) => {
  return (
    <div className="graph-empty">
      <div className="graph-empty-title">{title}</div>
      <div className="graph-empty-message">{message}</div>
      {action && <div className="graph-empty-action">{action}</div>}
    </div>
  );
};
