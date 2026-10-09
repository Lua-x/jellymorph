import { createBrowserRouter } from 'react-router';
import { paths } from '@/navigation/paths';
import { registerPreload } from '@/navigation/preload';
import { BootSplash } from './BootSplash';
import { LoginRoute, PasswordRoute, QuickConnectRoute, ServerRoute } from './routes/AuthRoutes';
import { RootLayout, RouteErrorBoundary } from './routes/RootLayout';
import { ServerGuard, SessionGuard } from './routes/guards';
import { ShellLayout } from './routes/ShellLayout';

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
                // Pages inside the shell are descendant routes, so an overlay can keep the page
                // underneath mounted (routes/ShellRoutes.tsx).
                { path: '*', element: <ShellLayout /> },
              ],
            },
          ],
        },
      ],
    },
  ]);
}
