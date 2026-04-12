import { useState, useEffect } from 'react';

/**
 * Media query list type for TypeScript compatibility
 */
type MediaQueryListType = Pick<MediaQueryList, 'matches' | 'addEventListener' | 'removeEventListener'>;

/**
 * Custom hook to detect user's reduced motion preference
 * @returns A tuple containing [prefersReducedMotion, setReducedMotion]
 * - prefersReducedMotion: boolean indicating if user prefers reduced motion
 * - setReducedMotion: function to manually override the preference
 */
export const useReducedMotion = (): [boolean, (value: boolean) => void] => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);
  const [manualOverride, setManualOverride] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery: MediaQueryListType = window.matchMedia('(prefers-reduced-motion: reduce)');

    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      if (manualOverride === null) {
        setPrefersReducedMotion(event.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [manualOverride]);

  const handleSetReducedMotion = (value: boolean) => {
    setManualOverride(value);
    setPrefersReducedMotion(value);
  };

  const effectiveValue = manualOverride !== null ? manualOverride : prefersReducedMotion;

  return [effectiveValue, handleSetReducedMotion];
};

/**
 * Custom hook to detect media query matches with SSR compatibility
 * @param query - CSS media query string
 * @returns boolean indicating if the media query matches
 */
const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery: MediaQueryListType = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
};

/**
 * Type definition for the return value of useReducedMotion hook
 */
export type UseReducedMotionReturn = [boolean, (value: boolean) => void];
