import { useState } from 'react';
import { authService, type GarminCredentials } from '../../services/authService';
import { Watch, Lock, ArrowRight, Loader2, CheckCircle, AlertCircle, SkipForward } from 'lucide-react';

interface GarminConnectFormProps {
  onSuccess: () => void;
  onSkip?: () => void;
}

export function GarminConnectForm({ onSuccess, onSkip }: GarminConnectFormProps) {
  const [credentials, setCredentials] = useState<GarminCredentials>({
    garminUsername: '',
    garminPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await authService.connectGarmin(credentials);
    
    setIsLoading(false);
    
    if (result.success) {
      onSuccess();
    } else {
      setError(result.error || 'Failed to connect Garmin');
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-[#00D4AA]/20 flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
          <Watch className="w-8 h-8 text-[#00D4AA]" />
        </div>
        <h2 className="font-display font-bold text-2xl text-white mb-2">
          Connect Your Garmin
        </h2>
        <p className="text-white/60">
          Link your Garmin account to enable personalized coaching
        </p>
      </div>

      {/* Benefits */}
      <div className="mb-6 space-y-2">
        {[
          'Auto-sync after every run',
          'Personalized training plans',
          'Weather-aware adjustments',
          'AI-powered run analysis',
        ].map((benefit, i) => (
          <div key={i} className="flex items-center gap-2 text-white/70 text-sm">
            <CheckCircle className="w-4 h-4 text-[#00D4AA]" />
            {benefit}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Watch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            type="text"
            value={credentials.garminUsername}
            onChange={(e) => setCredentials(prev => ({ ...prev, garminUsername: e.target.value }))}
            placeholder="Garmin Connect username/email"
            className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-[#00D4AA] transition-colors"
            disabled={isLoading}
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={credentials.garminPassword}
            onChange={(e) => setCredentials(prev => ({ ...prev, garminPassword: e.target.value }))}
            placeholder="Garmin Connect password"
            className="w-full pl-12 pr-16 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-[#00D4AA] transition-colors"
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        {/* Security note */}
        <div className="flex items-start gap-2 text-white/40 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            Your credentials are securely validated with Garmin and stored encrypted. 
            We never share them with third parties.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !credentials.garminUsername || !credentials.garminPassword}
          className="w-full btn-accent flex items-center justify-center gap-2 py-4 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Validating with Garmin...
            </>
          ) : (
            <>
              Connect Garmin
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="w-full py-3 text-white/50 hover:text-white text-sm transition-colors flex items-center justify-center gap-2"
          >
            <SkipForward className="w-4 h-4" />
            Skip for now
          </button>
        )}
      </form>
    </div>
  );
}
