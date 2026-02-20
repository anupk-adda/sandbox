import { useState } from 'react';
import { authService, type UserCredentials } from '../../services/authService';
import { User, Lock, ArrowRight, Loader2, UserPlus } from 'lucide-react';

interface LoginFormProps {
  onSuccess: () => void;
  onSwitchToSignup: () => void;
  onForgotPassword: () => void;
}

export function LoginForm({ onSuccess, onSwitchToSignup, onForgotPassword }: LoginFormProps) {
  const [credentials, setCredentials] = useState<UserCredentials & { rememberMe: boolean }>({
    username: '',
    password: '',
    rememberMe: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await authService.login(credentials);
    
    setIsLoading(false);
    
    if (result.success) {
      onSuccess();
    } else {
      setError(result.error || 'Login failed');
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-[#00D4AA]/20 flex items-center justify-center mx-auto mb-4">
          <User className="w-8 h-8 text-[#00D4AA]" />
        </div>
        <h2 className="font-display font-bold text-2xl text-white mb-2">
          Welcome back
        </h2>
        <p className="text-white/60">
          Sign in to access your personalized training
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            type="text"
            value={credentials.username}
            onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
            placeholder="Username"
            className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-[#00D4AA] transition-colors"
            disabled={isLoading}
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            type="password"
            value={credentials.password}
            onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
            placeholder="Password"
            className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-[#00D4AA] transition-colors"
            disabled={isLoading}
          />
        </div>

        {/* Remember Me & Forgot Password */}
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={credentials.rememberMe}
              onChange={(e) => setCredentials(prev => ({ ...prev, rememberMe: e.target.checked }))}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#00D4AA] focus:ring-[#00D4AA] focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-white/60 group-hover:text-white/80 transition-colors">
              Remember me
            </span>
          </label>
          
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-[#00D4AA] hover:underline"
          >
            Forgot password?
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !credentials.username || !credentials.password}
          className="w-full btn-accent flex items-center justify-center gap-2 py-4 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-white/40 text-sm">
          Don't have an account?{' '}
          <button 
            onClick={onSwitchToSignup}
            className="text-[#00D4AA] hover:underline inline-flex items-center gap-1"
          >
            <UserPlus className="w-3 h-3" />
            Create one
          </button>
        </p>
      </div>
    </div>
  );
}
