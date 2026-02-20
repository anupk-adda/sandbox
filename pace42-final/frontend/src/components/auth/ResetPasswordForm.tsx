import { useState, useEffect } from 'react';
import { authService } from '../../services/authService';
import { Lock, Eye, EyeOff, ArrowRight, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface ResetPasswordFormProps {
  token: string;
  onSuccess: () => void;
}

export function ResetPasswordForm({ token, onSuccess }: ResetPasswordFormProps) {
  const [passwords, setPasswords] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  });

  useEffect(() => {
    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    const result = await authService.verifyResetToken(token);
    if (!result.valid) {
      setError(result.error || 'Invalid or expired reset link');
    }
    setIsVerifying(false);
  };

  const checkPasswordStrength = (password: string) => {
    setPasswordStrength({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[@$!%*?&]/.test(password),
    });
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setPasswords(prev => ({ ...prev, newPassword }));
    checkPasswordStrength(newPassword);
  };

  const getStrengthPercentage = () => {
    const checks = Object.values(passwordStrength);
    const passed = checks.filter(Boolean).length;
    return (passed / checks.length) * 100;
  };

  const getStrengthColor = () => {
    const percentage = getStrengthPercentage();
    if (percentage <= 20) return 'bg-red-500';
    if (percentage <= 40) return 'bg-orange-500';
    if (percentage <= 60) return 'bg-yellow-500';
    if (percentage <= 80) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (passwords.newPassword !== passwords.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const strength = getStrengthPercentage();
    if (strength < 60) {
      setError('Please choose a stronger password');
      return;
    }

    setIsLoading(true);

    const result = await authService.resetPassword(token, passwords.newPassword);
    
    setIsLoading(false);
    
    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } else {
      setError(result.error || 'Failed to reset password');
    }
  };

  if (isVerifying) {
    return (
      <div className="w-full max-w-md text-center py-12">
        <Loader2 className="w-8 h-8 text-[#00D4AA] animate-spin mx-auto mb-4" />
        <p className="text-white/60">Verifying reset link...</p>
      </div>
    );
  }

  if (error && !success) {
    return (
      <div className="w-full max-w-md text-center py-12">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="font-display font-bold text-2xl text-white mb-2">
          Invalid Link
        </h2>
        <p className="text-white/60 mb-6">
          {error}
        </p>
        <button
          onClick={onSuccess}
          className="btn-accent inline-flex items-center gap-2"
        >
          Go to sign in
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full max-w-md text-center py-12">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="font-display font-bold text-2xl text-white mb-2">
          Password Reset!
        </h2>
        <p className="text-white/60">
          Your password has been reset successfully. Redirecting to sign in...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-[#00D4AA]/20 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-[#00D4AA]" />
        </div>
        <h2 className="font-display font-bold text-2xl text-white mb-2">
          Reset password
        </h2>
        <p className="text-white/60">
          Create a new secure password for your account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* New Password */}
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={passwords.newPassword}
            onChange={handlePasswordChange}
            placeholder="New password"
            className="w-full pl-12 pr-12 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-[#00D4AA] transition-colors"
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        {/* Password Strength Indicator */}
        {passwords.newPassword && (
          <div className="space-y-2">
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${getStrengthColor()}`}
                style={{ width: `${getStrengthPercentage()}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div className={`flex items-center gap-1 ${passwordStrength.length ? 'text-green-400' : 'text-white/40'}`}>
                <span>{passwordStrength.length ? '✓' : '○'}</span> At least 8 characters
              </div>
              <div className={`flex items-center gap-1 ${passwordStrength.uppercase ? 'text-green-400' : 'text-white/40'}`}>
                <span>{passwordStrength.uppercase ? '✓' : '○'}</span> Uppercase letter
              </div>
              <div className={`flex items-center gap-1 ${passwordStrength.lowercase ? 'text-green-400' : 'text-white/40'}`}>
                <span>{passwordStrength.lowercase ? '✓' : '○'}</span> Lowercase letter
              </div>
              <div className={`flex items-center gap-1 ${passwordStrength.number ? 'text-green-400' : 'text-white/40'}`}>
                <span>{passwordStrength.number ? '✓' : '○'}</span> Number
              </div>
              <div className={`flex items-center gap-1 ${passwordStrength.special ? 'text-green-400' : 'text-white/40'}`}>
                <span>{passwordStrength.special ? '✓' : '○'}</span> Special character
              </div>
            </div>
          </div>
        )}

        {/* Confirm Password */}
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={passwords.confirmPassword}
            onChange={(e) => setPasswords(prev => ({ ...prev, confirmPassword: e.target.value }))}
            placeholder="Confirm new password"
            className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-[#00D4AA] transition-colors"
            disabled={isLoading}
          />
        </div>

        {passwords.confirmPassword && passwords.newPassword !== passwords.confirmPassword && (
          <div className="text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Passwords do not match
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !passwords.newPassword || passwords.newPassword !== passwords.confirmPassword}
          className="w-full btn-accent flex items-center justify-center gap-2 py-4 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Resetting...
            </>
          ) : (
            <>
              Reset password
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
