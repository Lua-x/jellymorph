import { useTranslation } from 'react-i18next';
import type { ExternalIdField } from '@/domain/types';

/**
 * Labels for external ID fields. A provider can have several (a movie's own ID and the ID of its
 * collection); those get what they refer to added.
 */
export function useExternalIdLabel(fields: readonly ExternalIdField[]) {
  const { t } = useTranslation('content');
  return (field: ExternalIdField) => {
    const shared = fields.filter((other) => other.name === field.name).length > 1;
    if (!shared || !field.mediaType) return field.name;
    const type = t(`admin.mediaTypes.${field.mediaType}`, { defaultValue: field.mediaType });
    return t('admin.externalIdOf', { name: field.name, type });
  };
}
