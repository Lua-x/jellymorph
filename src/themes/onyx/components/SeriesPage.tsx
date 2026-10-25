import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useMediaActions } from '@/hooks/useMediaActions';
import type { SeriesPageProps } from '../../contract';
import { Icon } from '../../default/components/icons';
import { OnyxButton } from './OnyxButton';
import styles from './Detail.module.css';
import { DetailHeader } from './DetailHeader';
import { DetailsSection, EpisodesSection, ExtrasSection, RelatedRow } from './DetailSections';

/** A series: the stage with "play next", season chips and episodes, more like this, extras. */
export function SeriesPage({
  series,
  seasons,
  selectedSeasonId,
  onSelectSeason,
  episodes,
  nextUp,
  similar,
  layout,
}: SeriesPageProps) {
  const { t } = useTranslation('content');
  const actions = useMediaActions();
  const headingId = useId();
  const next = nextUp.status === 'success' ? nextUp.data : null;

  return (
    <article className={styles.page} aria-labelledby={headingId}>
      <DetailHeader
        layout={layout}
        item={series}
        headingId={headingId}
        actions={
          nextUp.status === 'success' && (
            <OnyxButton
              variant="primary"
              size="lg"
              icon={<Icon name="play" filled />}
              data-autofocus
              onFocus={actions.preparePlayback}
              onPointerEnter={actions.preparePlayback}
              onClick={() => {
                if (next)
                  actions.play(next, next.userData.progress !== null ? 'resume' : 'beginning');
                else actions.play(series, 'ask');
              }}
            >
              {next && next.userData.progress !== null ? t('detail.resume') : t('actions.play')}
              {next && (
                <span className={styles.nextLabel}>
                  {t('detail.episodeShort', {
                    season: next.episode?.seasonNumber ?? 0,
                    episode: next.episode?.episodeNumber ?? 0,
                    name: next.name,
                  })}
                </span>
              )}
            </OnyxButton>
          )
        }
      />
      <div className={styles.sections}>
        <EpisodesSection
          seasons={seasons}
          selectedSeasonId={selectedSeasonId}
          onSelectSeason={onSelectSeason}
          episodes={episodes}
          nextUpId={next?.id ?? null}
        />
        <RelatedRow items={similar} />
        <ExtrasSection item={series} />
        <DetailsSection item={series} facts={layout.facts} />
      </div>
    </article>
  );
}
