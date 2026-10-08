import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { JellyImage } from '@/ui/JellyImage';
import { formatClock } from '@/ui/time';
import type { ResumePromptProps } from '../../contract';
import { Icon } from '../../default/components/icons';
import { EnergyBar } from './EnergyBar';
import { NeonButton } from './NeonButton';
import styles from './ResumePrompt.module.css';

/** "Resume or start over" as a HUD dialog over the backdrop. */
export function ResumePrompt({
  item,
  positionSeconds,
  onResume,
  onRestart,
  onCancel,
}: ResumePromptProps) {
  const { t } = useTranslation('player');
  const titleId = useId();
  const resumeRef = useRef<HTMLButtonElement>(null);
  const backdrop = item.images.backdrop ?? item.images.thumb ?? item.images.primary;
  const progress = item.userData.progress;
  const episode = item.episode;

  useEffect(() => {
    resumeRef.current?.focus({ preventScroll: true });
  }, []);

  // Escape and the back keys of remotes cancel; the document listener runs before the app's
  // back handling on window, which then sees defaultPrevented.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (['Escape', 'Backspace', 'GoBack', 'BrowserBack'].includes(event.key)) {
        event.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onCancel]);

  return (
    <main id="main" className={styles.prompt} aria-labelledby={titleId}>
      <div className={styles.backdrop} aria-hidden="true">
        <JellyImage image={backdrop} sizes="100vw" priority />
        <span className={styles.scanlines} />
      </div>
      <div className={styles.panel}>
        <p className={styles.kicker}>{t('resume.title')}</p>
        <h1 id={titleId} className={styles.title}>
          {episode ? episode.seriesName : item.name}
        </h1>
        {episode && (
          <p className={styles.subtitle}>
            {episode.seasonNumber !== null && episode.episodeNumber !== null
              ? `${t('episodeCode', { season: episode.seasonNumber, episode: episode.episodeNumber })} · `
              : ''}
            {item.name}
          </p>
        )}
        {progress !== null && (
          <div className={styles.progress}>
            <EnergyBar value={progress} segments={30} />
            <span className={styles.progressText}>
              {t('resume.watched', { percent: Math.round(progress * 100) })}
            </span>
          </div>
        )}
        <div className={styles.actions}>
          <NeonButton
            ref={resumeRef}
            size="lg"
            icon={<Icon name="play" filled />}
            onClick={onResume}
          >
            {t('resume.resumeFrom', { time: formatClock(positionSeconds) })}
          </NeonButton>
          <NeonButton
            variant="secondary"
            size="lg"
            icon={<Icon name="refresh" />}
            onClick={onRestart}
          >
            {t('resume.restart')}
          </NeonButton>
          <NeonButton variant="ghost" size="lg" onClick={onCancel}>
            {t('resume.cancel')}
          </NeonButton>
        </div>
      </div>
    </main>
  );
}
