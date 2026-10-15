import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { LayoutEditorList, LayoutEditorModel } from '@/settings/model';
import { Button } from './Button';
import { Icon } from './icons';
import styles from './LayoutEditor.module.css';
import { SortableList } from './SortableList';

function ListCard({ list, scope }: { list: LayoutEditorList; scope: LayoutEditorModel['scope'] }) {
  const { t } = useTranslation('settings');
  const titleId = useId();
  const title = t(`layout.lists.${list.id}`);
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.titles}>
          <h3 id={titleId} className={styles.cardTitle}>
            {title}
          </h3>
          <span className={styles.state}>
            {t(`layout.${scope}_${list.customized ? 'customized' : 'default'}`)}
          </span>
        </div>
        {list.customized && (
          <Button
            variant="ghost"
            icon={<Icon name="refresh" />}
            aria-label={t('layout.resetNamed', { list: title })}
            onClick={list.reset}
          >
            {t('layout.reset')}
          </Button>
        )}
      </div>
      <SortableList
        labelledBy={titleId}
        entries={list.entries}
        onMove={list.move}
        onHiddenChange={list.setHidden}
      />
    </div>
  );
}

/**
 * The four lists to arrange (phase 14). For the default for everybody, changes collect in a
 * draft and an administrator saves them for all users at once.
 */
export function LayoutEditor({ layout }: { layout: LayoutEditorModel }) {
  const { t } = useTranslation('settings');
  const { distribution } = layout;
  const showSaveBar =
    layout.scope === 'everybody' && (layout.draftChanged || distribution.state !== 'idle');

  return (
    <div className={styles.editor}>
      <div className={styles.grid}>
        {layout.lists.map((list) => (
          <ListCard key={list.id} list={list} scope={layout.scope} />
        ))}
      </div>
      {showSaveBar && (
        <div className={styles.saveBar}>
          <p className={styles.saveState} role="status">
            {distribution.state === 'saving'
              ? t('layout.saving', { done: distribution.written, total: distribution.total })
              : distribution.state === 'saved'
                ? t('layout.saved', { count: distribution.written })
                : distribution.state === 'error'
                  ? distribution.total > 0
                    ? t('layout.partly', {
                        written: distribution.written,
                        total: distribution.total,
                        failed: distribution.failed,
                      })
                    : t('layout.failed')
                  : t('layout.unsaved')}
          </p>
          {layout.draftChanged && (
            <div className={styles.saveActions}>
              <Button variant="ghost" onClick={layout.discardDefault}>
                {t('layout.discard')}
              </Button>
              <Button busy={distribution.state === 'saving'} onClick={layout.saveDefault}>
                {t('layout.save')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
