import { useParams } from 'react-router';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useLibraryBrowser, type LibrarySourceKind } from '@/hooks/useLibraryBrowser';
import { ThemeSlot } from '@/themes/ThemeSlot';

function Browser({ kind, id }: { kind: LibrarySourceKind; id: string }) {
  const browser = useLibraryBrowser(kind, id);
  useDocumentTitle(browser.heading.status === 'success' ? browser.heading.data.title : null);
  return <ThemeSlot name="LibraryPage" props={{ browser }} />;
}

/** A new source is a new page: the key remounts it so paging state starts fresh. */
function BrowseRoute({ kind }: { kind: LibrarySourceKind }) {
  const { id = '' } = useParams();
  return <Browser key={`${kind}-${id}`} kind={kind} id={id} />;
}

export function LibraryRoute() {
  return <BrowseRoute kind="library" />;
}

export function CollectionRoute() {
  return <BrowseRoute kind="collection" />;
}

export function GenreRoute() {
  return <BrowseRoute kind="genre" />;
}

export function PersonRoute() {
  return <BrowseRoute kind="person" />;
}
