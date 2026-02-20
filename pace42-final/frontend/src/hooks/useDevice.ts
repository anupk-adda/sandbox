/**
 * Device Detection Hook
 * 
 * Provides responsive breakpoints and device type detection
 * for handling different screen sizes and device capabilities.
 */

import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'unknown';
export type Orientation = 'portrait' | 'landscape';

interface DeviceInfo {
  /** Current device type based on screen width */
  deviceType: DeviceType;
  /** Screen orientation */
  orientation: Orientation;
  /** Whether device is touch-capable */
  isTouch: boolean;
  /** Screen width in pixels */
  width: number;
  /** Screen height in pixels */
  height: number;
  /** Whether screen is in mobile breakpoint */
  isMobile: boolean;
  /** Whether screen is in tablet breakpoint */
  isTablet: boolean;
  /** Whether screen is in desktop breakpoint */
  isDesktop: boolean;
  /** Device pixel ratio */
  pixelRatio: number;
  /** Whether user prefers reduced motion */
  prefersReducedMotion: boolean;
  /** Whether user prefers dark mode */
  prefersDarkMode: boolean;
}

// Breakpoints (in pixels) - aligned with Tailwind defaults
const BREAKPOINTS = {
  sm: 640,   // Small devices (landscape phones)
  md: 768,   // Medium devices (tablets)
  lg: 1024,  // Large devices (desktops)
  xl: 1280,  // Extra large devices
  '2xl': 1536, // 2XL devices
} as const;

/**
 * Hook to detect device type and screen properties
 */
export function useDevice(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    deviceType: 'unknown',
    orientation: 'portrait',
    isTouch: false,
    width: window.innerWidth,
    height: window.innerHeight,
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    pixelRatio: window.devicePixelRatio || 1,
    prefersReducedMotion: false,
    prefersDarkMode: false,
  });

  useEffect(() => {
    const getDeviceType = (width: number): DeviceType => {
      if (width < BREAKPOINTS.md) return 'mobile';
      if (width < BREAKPOINTS.lg) return 'tablet';
      return 'desktop';
    };

    const getOrientation = (width: number, height: number): Orientation => {
      return width > height ? 'landscape' : 'portrait';
    };

    const updateDeviceInfo = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const deviceType = getDeviceType(width);

      setDeviceInfo({
        deviceType,
        orientation: getOrientation(width, height),
        isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
        width,
        height,
        isMobile: deviceType === 'mobile',
        isTablet: deviceType === 'tablet',
        isDesktop: deviceType === 'desktop',
        pixelRatio: window.devicePixelRatio || 1,
        prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        prefersDarkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
      });
    };

    // Initial detection
    updateDeviceInfo();

    // Listen for resize events with debounce
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateDeviceInfo, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', updateDeviceInfo);

    // Listen for media query changes
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    motionQuery.addEventListener('change', updateDeviceInfo);
    darkModeQuery.addEventListener('change', updateDeviceInfo);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', updateDeviceInfo);
      motionQuery.removeEventListener('change', updateDeviceInfo);
      darkModeQuery.removeEventListener('change', updateDeviceInfo);
      clearTimeout(resizeTimeout);
    };
  }, []);

  return deviceInfo;
}

/**
 * Hook to handle mobile-specific keyboard behavior
 */
export function useVirtualKeyboard() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // iOS Safari specific: visualViewport API
    if ('visualViewport' in window) {
      const visualViewport = window.visualViewport;
      
      const handleResize = () => {
        const heightDiff = window.innerHeight - (visualViewport?.height || window.innerHeight);
        setKeyboardHeight(Math.max(0, heightDiff));
        setIsOpen(heightDiff > 100); // Threshold for keyboard detection
      };

      visualViewport?.addEventListener('resize', handleResize);
      return () => visualViewport?.removeEventListener('resize', handleResize);
    }

    // Fallback for focus/blur detection
    const handleFocus = () => setIsOpen(true);
    const handleBlur = () => setIsOpen(false);

    const inputs = document.querySelectorAll('input, textarea, [contenteditable]');
    inputs.forEach(input => {
      input.addEventListener('focus', handleFocus);
      input.addEventListener('blur', handleBlur);
    });

    return () => {
      inputs.forEach(input => {
        input.removeEventListener('focus', handleFocus);
        input.removeEventListener('blur', handleBlur);
      });
    };
  }, []);

  return { keyboardHeight, isOpen };
}

/**
 * Hook to detect if app is running as PWA (installed)
 */
export function usePWAStatus() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    // Check if running as installed PWA
    const standalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Check if can be installed
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  return { isStandalone, canInstall };
}

export default useDevice;
