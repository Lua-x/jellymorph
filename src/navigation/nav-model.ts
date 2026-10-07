export type NavIcon =
  'home' | 'search' | 'favorites' | 'movies' | 'shows' | 'collections' | 'videos' | 'folder';

export interface NavItem {
  id: string;
  label: string;
  to: string;
  icon: NavIcon;
  /** 'main' = always visible (home, search, favorites); 'library' = one per library. */
  group: 'main' | 'library';
}

/** Everything an AppShell needs for navigation and the user menu. */
export interface NavModel {
  appTitle: string;
  items: NavItem[];
  user: { name: string; imageUrl: string | null };
  serverName: string;
  switchProfile: () => void;
  changeServer: (() => void) | null;
  signOut: () => void;
  signingOut: boolean;
}
