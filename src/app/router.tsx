import { createBrowserRouter } from 'react-router';
import { paths } from '@/navigation/paths';
import { HomeRoute } from './routes/HomeRoute';
import { LoginRoute, PasswordRoute, QuickConnectRoute, ServerRoute } from './routes/AuthRoutes';
import { NotFoundRoute } from './routes/NotFoundRoute';
import { RootLayout, RouteErrorBoundary } from './routes/RootLayout';
import { ServerGuard, SessionGuard } from './routes/guards';
import { ShellLayout } from './routes/ShellLayout';

export function createAppRouter() {
  return createBrowserRouter([
    {
      element: <RootLayout />,
      errorElement: <RouteErrorBoundary />,
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
                  element: <ShellLayout />,
                  children: [
                    { index: true, element: <HomeRoute /> },
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
