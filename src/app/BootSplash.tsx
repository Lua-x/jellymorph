import { Logo } from '@/ui/Logo';

/** Same splash as in index.html, shown while the theme chunks load. */
export function BootSplash() {
  return (
    <div className="boot-splash" role="status" aria-label="Jellymorph">
      <Logo />
    </div>
  );
}
