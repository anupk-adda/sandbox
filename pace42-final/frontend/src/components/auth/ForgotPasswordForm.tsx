import { useState } from 'react';
import { authService } from '../../services/authService';
import { Mail, ArrowLeft, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface ForgotPasswordFormProps {
  onBack: () => void;
}

export function ForgotPasswordForm({ onBack }: ForgotPasswordFormProps) {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [devInfo, setDevInfo] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await authService.forgotPassword(username);
    
    setIsLoading(false);
    
    if (result.success) {
      setSuccess(true);
      setDevInfo(result.devInfo);
    } else {
      setError(result.error || 'Failed to process request');
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="font-display font-bold text-2xl text-white mb-2">
          Check your email
        </h2>
        <p className="text-white/60 mb-6">
          If an account exists with <span className="text-white font-medium">{username}</span>,
          you will receive password reset instructions shortly.
        </p>
        
        {/* Development Info - Remove in production */}
        {devInfo && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-left">
            <div className="flex items-center gap-2 mb-2 text-yellow-500">
              <AlertCircle className="w-4 h-4" />
              <span className="font-semibold text-sm">Development Mode</span>
            </div>
            <p className="text-yellow-400/80 text-xs mb-2">
              Reset token (copy this for testing):
            </p>
            <code className="block bg-black/30 p-2 rounded text-xs text-yellow-300 break-all font-mono">
              {devInfo.resetToken}
            </code>
            <p className="text-yellow-400/60 text-xs mt-2">
              Expires: {new Date(devInfo.expiresAt).toLocaleString()}
            </p>
          </div>
        )}

        <button
          onClick={onBack}
          className="text-[#00D4AA] hover:underline inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-[#00D4AA]/20 flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-[#00D4AA]" />
        </div>
        <h2 className="font-display font-bold text-2xl text-white mb-2">
          Forgot password?
        </h2>
        <p className="text-white/60">
          Enter your email and we'll send you instructions to reset your password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            type="email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your email"
            className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-[#00D4AA] transition-colors"
            disabled={isLoading}
            required
          />
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !username}
          className="w-full btn-accent flex items-center justify-center gap-2 py-4 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Sending...
            </>
          ) : (
            'Send reset instructions'
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          onClick={onBack}
          className="text-white/40 hover:text-white text-sm inline-flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </button>
      </div>
    </div>
  );
}
