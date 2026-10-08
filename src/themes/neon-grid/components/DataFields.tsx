import type { MediaItem } from '@/domain/types';
import styles from './DataFields.module.css';
import { useItemFields, type DataField } from './itemFields';

/**
 * Data as HUD fields: a small cyan label above each value. `compact` lays them out in one row
 * (hero, detail header), otherwise as a grid of cells.
 */
export function FieldGrid({ fields, compact = false }: { fields: DataField[]; compact?: boolean }) {
  if (fields.length === 0) return null;
  return (
    <dl className={compact ? `${styles.fields} ${styles.compact}` : styles.fields}>
      {fields.map((field) => (
        <div key={field.key} className={styles.field}>
          <dt className={styles.label}>{field.label}</dt>
          <dd className={styles.value}>{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The standard fields of an item (year, runtime or seasons, rating, score). */
export function DataFields({ item, compact = false }: { item: MediaItem; compact?: boolean }) {
  return <FieldGrid fields={useItemFields(item)} compact={compact} />;
}
