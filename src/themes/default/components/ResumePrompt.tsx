import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { JellyImage } from '@/ui/JellyImage';
import { formatClock } from '@/ui/time';
import type { ResumePromptProps } from '../../contract';
import { Button } from './Button';
import { Icon } from './icons';
import styles from './ResumePrompt.module.css';

/** Full screen question before playback: resume at the saved position or start over. */
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

  // Escape and the back keys of remotes cancel, like closing the player.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (['Escape', 'GoBack', 'BrowserBack'].includes(event.key)) {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onCancel]);

  return (
    <main id="main" className={styles.prompt} aria-labelledby={titleId}>
      <div className={styles.backdrop} aria-hidden="true">
        <JellyImage image={backdrop} sizes="100vw" priority />
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
            <span className={styles.progressBar}>
              <span style={{ transform: `scaleX(${String(progress)})` }} />
            </span>
            <span className={styles.progressText}>
              {t('resume.watched', { percent: Math.round(progress * 100) })}
            </span>
          </div>
        )}
        <div className={styles.actions}>
          <Button ref={resumeRef} size="lg" icon={<Icon name="play" filled />} onClick={onResume}>
            {t('resume.resumeFrom', { time: formatClock(positionSeconds) })}
          </Button>
          <Button variant="secondary" size="lg" icon={<Icon name="refresh" />} onClick={onRestart}>
            {t('resume.restart')}
          </Button>
          <Button variant="ghost" size="lg" onClick={onCancel}>
            {t('resume.cancel')}
          </Button>
        </div>
      </div>
    </main>
  );
}
