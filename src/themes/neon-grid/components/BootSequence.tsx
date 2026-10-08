import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_VERSION } from '@/config/version';
import styles from './BootSequence.module.css';
import { EnergyBar } from './EnergyBar';
import { NeonButton } from './NeonButton';
import { ScrambleText } from './ScrambleText';

const LINES = ['core', 'grid', 'link', 'secure', 'ready'] as const;
const FIRST_LINE_MS = 380;
const LINE_MS = 360;
const HOLD_MS = 500;

/**
 * Start-up sequence in front of the sign-in screens: status lines print one by one, then the
 * terminal opens. Any key, click or the skip button ends it; it runs once per browser session.
 */
export function BootSequence({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation('theme-neon-grid');
  const [shown, setShown] = useState(0);
  const skipRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDone();
    };
    if (shown >= LINES.length) {
      const timer = setTimeout(finish, HOLD_MS);
      return () => {
        clearTimeout(timer);
      };
    }
    const timer = setTimeout(
      () => {
        setShown((count) => count + 1);
      },
      shown === 0 ? FIRST_LINE_MS : LINE_MS,
    );
    return () => {
      clearTimeout(timer);
    };
  }, [shown, onDone]);

  useEffect(() => {
    skipRef.current?.focus({ preventScroll: true });
    const skip = (event: KeyboardEvent | PointerEvent) => {
      if (event instanceof KeyboardEvent && (event.key === 'Tab' || event.key === 'Shift')) return;
      // The keys end the sequence only; they must not also trigger "back" or a click below.
      event.preventDefault();
      if (doneRef.current) return;
      doneRef.current = true;
      onDone();
    };
    document.addEventListener('keydown', skip);
    document.addEventListener('pointerdown', skip);
    return () => {
      document.removeEventListener('keydown', skip);
      document.removeEventListener('pointerdown', skip);
    };
  }, [onDone]);

  return (
    <main id="main" className={styles.boot} aria-label={t('boot.label')}>
      <div className={styles.screen}>
        <p className={styles.title}>
          <ScrambleText text={t('boot.title', { version: `v${APP_VERSION}` })} />
        </p>
        <ol className={styles.lines} aria-hidden="true">
          {LINES.slice(0, shown).map((line, index) => (
            <li key={line} className={styles.line}>
              <span className={styles.ok}>[ {t('boot.ok')} ]</span>
              <span className={index === LINES.length - 1 ? styles.ready : undefined}>
                {t(`boot.lines.${line}`)}
              </span>
              {index === shown - 1 && <span className={styles.cursor} />}
            </li>
          ))}
        </ol>
        <EnergyBar value={shown / LINES.length} segments={LINES.length * 6} tone="cyan" />
      </div>
      <NeonButton ref={skipRef} variant="ghost" size="sm" className={styles.skip} onClick={onDone}>
        {t('boot.skip')}
      </NeonButton>
    </main>
  );
}
