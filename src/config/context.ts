import { createContext, use } from 'react';
import type { AppConfig } from './app-config';

export const ConfigContext = createContext<AppConfig | null>(null);

export function useAppConfig(): AppConfig {
  const config = use(ConfigContext);
  if (!config) throw new Error('useAppConfig must be used inside <ConfigContext>');
  return config;
}
