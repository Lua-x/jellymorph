import { QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import { RouterProvider } from 'react-router/dom';
import type { AppConfig } from '@/config/app-config';
import { ConfigContext } from '@/config/context';
import { ThemeProvider } from '@/themes/ThemeProvider';
import { BootSplash } from './BootSplash';
import { Environment } from './Environment';
import { createQueryClient } from './query-client';
import { createAppRouter } from './router';

export function App({ config }: { config: AppConfig }) {
  const [queryClient] = useState(createQueryClient);
  const [router] = useState(createAppRouter);
  return (
    <ConfigContext value={config}>
      <QueryClientProvider client={queryClient}>
        <Environment />
        <Suspense fallback={<BootSplash />}>
          <ThemeProvider defaultTheme={config.defaultTheme}>
            <RouterProvider router={router} />
          </ThemeProvider>
        </Suspense>
      </QueryClientProvider>
    </ConfigContext>
  );
}
