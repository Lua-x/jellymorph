import { scanLibrary } from '@/api/refresh';
import { useActiveSession } from './useSession';
import { useCurrentUser } from './useUser';

/** Whether the signed-in user administers the server; themes show admin entry points only then. */
export function useIsAdmin(): boolean {
  const user = useCurrentUser();
  return user.status === 'success' && user.data.isAdministrator;
}

/** Starts a scan of one library for new and removed files. */
export function useLibraryScan(): (libraryId: string) => Promise<void> {
  const { api } = useActiveSession();
  return (libraryId) => scanLibrary(api, libraryId);
}
