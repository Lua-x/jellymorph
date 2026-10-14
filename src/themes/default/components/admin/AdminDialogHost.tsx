import type { ItemDetail } from '@/domain/types';
import { IdentifyDialog } from './IdentifyDialog';
import { ImagesDialog } from './ImagesDialog';
import { DeleteDialog, RefreshDialog } from './MaintenanceDialogs';
import { MetadataDialog } from './MetadataDialog';
import { SubtitlesDialog } from './SubtitlesDialog';

export type AdminDialogKind =
  'identify' | 'metadata' | 'images' | 'subtitles' | 'refresh' | 'delete';

/** All administration dialogs in one lazy chunk: only administrators ever load it. */
export default function AdminDialogHost({
  kind,
  item,
  onClose,
}: {
  kind: AdminDialogKind;
  item: ItemDetail;
  onClose: () => void;
}) {
  switch (kind) {
    case 'identify':
      return item.kind === 'movie' || item.kind === 'series' ? (
        <IdentifyDialog item={item} kind={item.kind} onClose={onClose} />
      ) : null;
    case 'metadata':
      return <MetadataDialog item={item} onClose={onClose} />;
    case 'images':
      return <ImagesDialog item={item} onClose={onClose} />;
    case 'subtitles':
      return <SubtitlesDialog item={item} onClose={onClose} />;
    case 'refresh':
      return <RefreshDialog item={item} onClose={onClose} />;
    case 'delete':
      return <DeleteDialog item={item} onClose={onClose} />;
  }
}
