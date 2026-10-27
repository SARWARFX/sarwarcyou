/**
 * useRouter.ts
 * Reactive hash-based routing hook supporting native Back/Forward buttons and deep-linking.
 */

import { useState, useEffect, useCallback } from 'react';
import { parseHashRoute, buildRouteHash, type AppRoute } from './routes';

export function useRouter() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() =>
    typeof window !== 'undefined'
      ? parseHashRoute(window.location.hash)
      : { name: 'home' }
  );

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentRoute(parseHashRoute(window.location.hash));
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = useCallback((route: AppRoute, replace = false) => {
    const hash = buildRouteHash(route);
    if (replace) {
      const url = new URL(window.location.href);
      url.hash = hash;
      window.history.replaceState(null, '', url.toString());
      setCurrentRoute(route);
    } else {
      window.location.hash = hash;
    }
  }, []);

  const goBack = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate({ name: 'home' });
    }
  }, [navigate]);

  return {
    route: currentRoute,
    navigate,
    goBack,
  };
}
