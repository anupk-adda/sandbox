import React from 'react';
import { AlertCircle, Zap } from 'lucide-react';

interface UpgradePromptProps {
  type: 'plan' | 'query';
  tier: string;
  limit?: number;
  activePlans?: number;
  remaining?: number;
  onUpgrade?: () => void;
  onDismiss?: () => void;
}

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  type,
  tier,
  limit,
  activePlans,
  remaining,
  onUpgrade,
  onDismiss,
}) => {
  const getMessage = () => {
    if (type === 'plan') {
      return {
        title: 'Training Plan Limit Reached',
        description: `You've reached your ${tier} tier limit of ${limit} active training plan${limit === 1 ? '' : 's'}. Upgrade to Premium for unlimited plans.`,
        icon: <AlertCircle className="h-5 w-5 text-amber-500" />,
      };
    } else {
      return {
        title: 'Monthly Query Limit Reached',
        description: `You've used all ${limit} queries for this month. Upgrade to Premium for unlimited AI coaching and analysis.`,
        icon: <AlertCircle className="h-5 w-5 text-amber-500" />,
      };
    }
  };

  const message = getMessage();

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{message.icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            {message.title}
          </h3>
          <p className="text-sm text-gray-700 mb-3">{message.description}</p>
          
          {type === 'plan' && activePlans !== undefined && (
            <p className="text-xs text-gray-600 mb-3">
              Active plans: {activePlans} / {limit}
            </p>
          )}
          
          {type === 'query' && remaining !== undefined && (
            <p className="text-xs text-gray-600 mb-3">
              Queries remaining this month: {remaining} / {limit}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onUpgrade}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm"
            >
              <Zap className="h-4 w-4" />
              Upgrade to Premium
            </button>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Maybe Later
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpgradePrompt;
