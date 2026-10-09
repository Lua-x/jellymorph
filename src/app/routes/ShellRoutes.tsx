import { lazy, Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import { backgroundOf, OVERLAY_ROUTE } from '@/navigation/overlay';
import { ThemeSlot } from '@/themes/ThemeSlot';
import { HomeRoute } from './HomeRoute';
import { NotFoundRoute } from './NotFoundRoute';

/** Content pages other than home are separate chunks; the home page is the landing page. */
const browse = () => import('./LibraryRoute');
const LibraryRoute = lazy(() => browse().then((module) => ({ default: module.LibraryRoute })));
const CollectionRoute = lazy(() =>
  browse().then((module) => ({ default: module.CollectionRoute })),
);
const GenreRoute = lazy(() => browse().then((module) => ({ default: module.GenreRoute })));
const PersonRoute = lazy(() => browse().then((module) => ({ default: module.PersonRoute })));
const ItemRoute = lazy(() =>
  import('./ItemRoute').then((module) => ({ default: module.ItemRoute })),
);
const SearchRoute = lazy(() =>
  import('./SearchRoute').then((module) => ({ default: module.SearchRoute })),
);
const FavoritesRoute = lazy(() =>
  import('./FavoritesRoute').then((module) => ({ default: module.FavoritesRoute })),
);
const SettingsRoute = lazy(() =>
  import('./SettingsRoute').then((module) => ({ default: module.SettingsRoute })),
);

/**
 * The pages inside the app shell. Normally the current URL decides the page. A link opened as an
 * overlay (themes with `detailPresentation: 'modal'`) keeps the page it came from in the history
 * state: that page stays mounted underneath, untouched and inert, and the details render above
 * it. Back closes the overlay and the page is exactly as it was, scroll positions included.
 */
export function ShellRoutes() {
  const location = useLocation();
  const background = backgroundOf(location);

  return (
    <>
      <Suspense fallback={<ThemeSlot name="LoadingState" props={{}} />}>
        <div inert={background !== null}>
          <Routes location={background ?? location}>
            <Route index element={<HomeRoute />} />
            <Route path="/library/:id" element={<LibraryRoute />} />
            <Route path="/collection/:id" element={<CollectionRoute />} />
            <Route path="/genre/:id" element={<GenreRoute />} />
            <Route path="/person/:id" element={<PersonRoute />} />
            <Route path="/item/:itemId" element={<ItemRoute />} />
            <Route path="/search" element={<SearchRoute />} />
            <Route path="/favorites" element={<FavoritesRoute />} />
            <Route path="/settings" element={<SettingsRoute />} />
            <Route path="*" element={<NotFoundRoute />} />
          </Routes>
        </div>
      </Suspense>
      {background && (
        // Its own boundary: loading the details must not blank the page underneath.
        <Suspense fallback={null}>
          <Routes>
            <Route path={OVERLAY_ROUTE} element={<ItemRoute presentation="modal" />} />
          </Routes>
        </Suspense>
      )}
    </>
  );
}
