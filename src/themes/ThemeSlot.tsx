import { Component, type ComponentProps, type ComponentType, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ThemeComponents, ThemeSlot as Slot } from './contract';
import { useFallbackComponent, useThemeComponent } from './context';

interface BoundaryProps {
  slot: Slot;
  fallback: ReactNode;
  children: ReactNode;
}

class SlotBoundary extends Component<BoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.error(`Theme component "${this.props.slot}" failed; using the default theme.`, error);
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Last resort when even the default theme fails: plain text, no theme styles involved. */
function BrokenSlot() {
  const { t } = useTranslation('errors');
  return (
    <p role="alert" style={{ padding: '2rem', textAlign: 'center' }}>
      {t('unknown.title')}
    </p>
  );
}

type SlotProps<S extends Slot> = ComponentProps<ThemeComponents[S]>;
/** Inside the slot the concrete props type is already checked at the call site. */
type ResolvedProps = Record<string, unknown>;

/**
 * Renders the active theme's component for a slot. If it throws, the default theme's component
 * takes over, so a broken theme never takes the whole app down.
 */
export function ThemeSlot<S extends Slot>({ name, props }: { name: S; props: SlotProps<S> }) {
  const Active = useThemeComponent(name) as unknown as ComponentType<ResolvedProps>;
  const Fallback = useFallbackComponent(name) as unknown as ComponentType<ResolvedProps>;
  const resolved = props as unknown as ResolvedProps;
  const fallback = Active === Fallback ? <BrokenSlot /> : <Fallback {...resolved} />;
  return (
    <SlotBoundary slot={name} fallback={fallback}>
      <Active {...resolved} />
    </SlotBoundary>
  );
}
