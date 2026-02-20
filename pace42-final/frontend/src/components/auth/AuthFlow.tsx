import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authService, type AuthState } from '../../services/authService';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { GarminConnectForm } from './GarminConnectForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { ResetPasswordForm } from './ResetPasswordForm';
import { Chat } from '../Chat';
import { Logo } from './Logo';
import { CheckCircle, XCircle, Loader2, LayoutDashboard } from 'lucide-react';

type AuthView = 'login' | 'signup' | 'forgot-password' | 'reset-password' | 'garmin' | 'chat';

interface ServiceStatus {
  healthy: boolean;
  services: {
    backend: boolean;
    agent: boolean;
  };
}

export function AuthFlow() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<AuthView>('login');
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isGarminConnected: false,
    user: null,
  });
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [isCheckingServices, setIsCheckingServices] = useState(true);

  useEffect(() => {
    // Check for reset token in URL
    const resetToken = searchParams.get('token');
    if (resetToken) {
      setView('reset-password');
      return;
    }

    // Subscribe to auth state changes
    const unsubscribe = authService.subscribe((state) => {
      setAuthState(state);
    });

    // Check initial state
    const initialState = authService.getState();
    setAuthState(initialState);

    // If already authenticated, go to chat or garmin
    if (initialState.isAuthenticated) {
      if (initialState.isGarminConnected) {
        setView('chat');
      } else {
        setView('garmin');
      }
    }

    // Check backend services
    checkServices();

    return unsubscribe;
  }, [searchParams]);

  const checkServices = async () => {
    setIsCheckingServices(true);
    const status = await authService.checkBackendHealth();
    setServiceStatus(status);
    setIsCheckingServices(false);
  };

  const handleLoginSuccess = () => {
    const state = authService.getState();
    if (state.isGarminConnected) {
      setView('chat');
    } else {
      setView('garmin');
    }
  };

  const handleSignupSuccess = () => {
    setView('garmin');
  };

  const handleGarminSuccess = () => {
    setView('chat');
  };

  const handleSkipGarmin = () => {
    setView('chat');
  };

  const handleResetPasswordSuccess = () => {
    // Clear the token from URL
    setSearchParams({});
    // Use window.location to clear URL without triggering React Router navigation issues
    window.history.replaceState({}, '', window.location.pathname);
    setView('login');
  };

  // Progress indicator
  const getProgress = () => {
    switch (view) {
      case 'login':
      case 'signup':
      case 'forgot-password':
      case 'reset-password':
        return 33;
      case 'garmin': return 66;
      case 'chat': return 100;
      default: return 0;
    }
  };

  // Service status indicator
  const renderServiceStatus = () => {
    if (isCheckingServices) {
      return (
        <div className="flex items-center gap-2 text-white/50 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Checking services...
        </div>
      );
    }

    if (!serviceStatus) return null;

    return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2" title="Backend API">
          {serviceStatus.services.backend ? (
            <CheckCircle className="w-4 h-4 text-[#00D4AA]" />
          ) : (
            <XCircle className="w-4 h-4 text-red-500" />
          )}
          <span className={`text-xs ${serviceStatus.services.backend ? 'text-[#00D4AA]' : 'text-red-500'}`}>
            API
          </span>
        </div>
        <div className="flex items-center gap-2" title="Agent Service">
          {serviceStatus.services.agent ? (
            <CheckCircle className="w-4 h-4 text-[#00D4AA]" />
          ) : (
            <XCircle className="w-4 h-4 text-red-500" />
          )}
          <span className={`text-xs ${serviceStatus.services.agent ? 'text-[#00D4AA]' : 'text-red-500'}`}>
            Agent
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0A0C0F] flex flex-col">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0A0C0F]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Logo />
            
            {/* Dashboard Link + Service Status */}
            <div className="flex items-center gap-4">
              {view === 'chat' && (
                <Link
                  to="/dashboard"
                  className="flex items-center gap-2 text-sm text-white/60 hover:text-[#00D4AA] transition-colors"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Link>
              )}
              {renderServiceStatus()}
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        {view !== 'chat' && (
          <div className="h-1 bg-white/5">
            <div 
              className="h-full bg-[#00D4AA] transition-all duration-500"
              style={{ width: `${getProgress()}%` }}
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        {/* Background decoration */}
        <div className="absolute inset-0 data-grid opacity-20 pointer-events-none" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00D4AA]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00D4AA]/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 w-full">
          {view === 'login' && (
            <div className="animate-fade-in">
              <LoginForm 
                onSuccess={handleLoginSuccess} 
                onSwitchToSignup={() => setView('signup')}
                onForgotPassword={() => setView('forgot-password')}
              />
            </div>
          )}
          
          {view === 'signup' && (
            <div className="animate-fade-in">
              <SignupForm 
                onSuccess={handleSignupSuccess}
                onSwitchToLogin={() => setView('login')}
              />
            </div>
          )}

          {view === 'forgot-password' && (
            <div className="animate-fade-in">
              <ForgotPasswordForm 
                onBack={() => setView('login')}
              />
            </div>
          )}

          {view === 'reset-password' && (
            <div className="animate-fade-in">
              <ResetPasswordForm 
                token={searchParams.get('token') || ''}
                onSuccess={handleResetPasswordSuccess}
              />
            </div>
          )}
          
          {view === 'garmin' && (
            <div className="animate-fade-in">
              <GarminConnectForm 
                onSuccess={handleGarminSuccess} 
                onSkip={handleSkipGarmin}
              />
            </div>
          )}
          
          {view === 'chat' && (
            <div className="h-[calc(100vh-80px)] animate-fade-in">
              <Chat 
                isGarminConnected={authState.isGarminConnected}
                garminUsername={authState.user?.garminUsername}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
