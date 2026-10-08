import { createBrowserRouter } from 'react-router';
import { paths } from '@/navigation/paths';
import { registerPreload } from '@/navigation/preload';
import { BootSplash } from './BootSplash';
import { LoginRoute, PasswordRoute, QuickConnectRoute, ServerRoute } from './routes/AuthRoutes';
import { HomeRoute } from './routes/HomeRoute';
import { NotFoundRoute } from './routes/NotFoundRoute';
import { RootLayout, RouteErrorBoundary } from './routes/RootLayout';
import { ServerGuard, SessionGuard } from './routes/guards';
import { ShellLayout } from './routes/ShellLayout';

/** Content pages other than home are separate chunks; the home page is the landing page. */
const browse = () => import('./routes/LibraryRoute');
const player = () => import('./routes/PlayerRoute');

// "Play" buttons load the player (and hls.js for transcoded streams) when they get focus.
registerPreload('player', () => Promise.all([player(), import('@/player/engines/hlsjs')]));

export function createAppRouter() {
  return createBrowserRouter([
    {
      element: <RootLayout />,
      errorElement: <RouteErrorBoundary />,
      hydrateFallbackElement: <BootSplash />,
      children: [
        { path: paths.servers, element: <ServerRoute /> },
        {
          element: <ServerGuard />,
          children: [
            { path: paths.login, element: <LoginRoute /> },
            { path: '/login/password', element: <PasswordRoute /> },
            { path: paths.quickConnect, element: <QuickConnectRoute /> },
            {
              element: <SessionGuard />,
              children: [
                {
                  path: '/play/:itemId',
                  lazy: async () => ({ Component: (await player()).PlayerRoute }),
                },
                {
                  element: <ShellLayout />,
                  children: [
                    { index: true, element: <HomeRoute /> },
                    {
                      path: '/library/:id',
                      lazy: async () => ({ Component: (await browse()).LibraryRoute }),
                    },
                    {
                      path: '/collection/:id',
                      lazy: async () => ({ Component: (await browse()).CollectionRoute }),
                    },
                    {
                      path: '/genre/:id',
                      lazy: async () => ({ Component: (await browse()).GenreRoute }),
                    },
                    {
                      path: '/person/:id',
                      lazy: async () => ({ Component: (await browse()).PersonRoute }),
                    },
                    {
                      path: '/item/:itemId',
                      lazy: async () => ({
                        Component: (await import('./routes/ItemRoute')).ItemRoute,
                      }),
                    },
                    {
                      path: paths.search(),
                      lazy: async () => ({
                        Component: (await import('./routes/SearchRoute')).SearchRoute,
                      }),
                    },
                    {
                      path: paths.favorites,
                      lazy: async () => ({
                        Component: (await import('./routes/FavoritesRoute')).FavoritesRoute,
                      }),
                    },
                    { path: '*', element: <NotFoundRoute /> },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ]);
}
