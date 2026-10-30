/**
 * useMediaQuery — reactive CSS media query for client components.
 *
 * Used to swap between a mobile and a desktop UI variant. Unlike a Tailwind
 * `md:hidden` / `hidden md:flex` pair, this renders only ONE variant at a
 * time, which matters for Radix popovers: their content is portalled to
 * `document.body`, so a hidden-by-CSS trigger would still render a visible
 * (and focus-stealing) popover on the other breakpoint.
 *
 * The first render uses `matchMedia` synchronously when the browser is
 * available, so there is no desktop-then-mobile flash on client-only trees.
 */
'use client';

import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** True on phone-sized viewports (below Tailwind's `md` breakpoint). */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}
