import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isNativeApp } from '../utils/location';
import { startBackgroundTracking, stopBackgroundTracking } from '../utils/backgroundLocation';

/**
 * Starts native background location reporting for students and stops it on
 * logout/unmount. No-op in the browser (PWA tracks only while open, via
 * `watchFixes`), so this is safe to mount unconditionally.
 */
export function useBackgroundTracking() {
  const { user, isLoading } = useAuth();
  const isStudent = !isLoading && user?.role?.toLowerCase() === 'student';

  useEffect(() => {
    if (!isStudent || !isNativeApp()) return;
    startBackgroundTracking().catch(() => { /* permission denied / unavailable */ });
    return () => { void stopBackgroundTracking(); };
  }, [isStudent]);
}
