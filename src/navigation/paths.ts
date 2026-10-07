/** All route paths in one place, so hooks and themes never hard-code URLs. */
export const paths = {
  home: '/',
  servers: '/servers',
  login: '/login',
  password: (username?: string) =>
    username ? `/login/password?user=${encodeURIComponent(username)}` : '/login/password',
  quickConnect: '/login/quick-connect',
} as const;

/** Router state used to return to the page that required a sign-in. */
export interface ReturnState {
  from?: string;
}

export function returnTarget(state: unknown): string {
  const from = (state as ReturnState | null)?.from;
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')
    ? from
    : paths.home;
}
