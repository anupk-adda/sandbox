import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { authService, type AuthState } from '../../services/authService';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { GarminConnectForm } from './GarminConnectForm';
import { Chat } from '../Chat';
import { Logo } from './Logo';
import { CheckCircle, XCircle, Loader2, LayoutDashboard } from 'lucide-react';

type AuthView = 'login' | 'signup' | 'garmin' | 'chat';

interface ServiceStatus {
  healthy: boolean;
  services: {
    backend: boolean;
    agent: boolean;
  };
}

export function AuthFlow() {
  const [view, setView] = useState<AuthView>('login');
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isGarminConnected: false,
    user: null,
  });
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [isCheckingServices, setIsCheckingServices] = useState(true);

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = authService.subscribe((state) => {
      setAuthState(state);
    });

    // Check initial state
    const initialState = authService.getState();
    setAuthState(initialState);

    // Check backend services
    checkServices();

    return unsubscribe;
  }, []);

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

  // Progress indicator
  const getProgress = () => {
    switch (view) {
      case 'login':
      case 'signup': return 33;
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
