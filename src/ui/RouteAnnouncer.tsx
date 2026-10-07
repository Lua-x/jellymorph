import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

/**
 * Announces page changes to screen readers. Client-side navigation does not trigger the
 * announcement a full page load would, so the new document title is read out instead.
 */
export function RouteAnnouncer() {
  const { pathname } = useLocation();
  const regionRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef(true);

  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    // Titles are set by the page effects; read them once those have run.
    const timer = setTimeout(() => {
      if (regionRef.current) regionRef.current.textContent = document.title;
    }, 100);
    return () => {
      clearTimeout(timer);
    };
  }, [pathname]);

  return <div ref={regionRef} className="visually-hidden" aria-live="polite" aria-atomic="true" />;
}
