import { useNavigate } from 'react-router';
import { getCurrentServer, useSessionStore } from '@/api/session-store';
import { paths } from '@/navigation/paths';

/** Action to pick another server, or null when the deployment pins the server. */
export function useServerChange(): (() => void) | null {
  const navigate = useNavigate();
  const fixed = useSessionStore((state) => getCurrentServer(state)?.fixed ?? false);
  if (fixed) return null;
  return () => {
    void navigate(paths.servers);
  };
}
