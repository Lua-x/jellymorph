export type NavIcon = 'home' | 'movies' | 'shows' | 'collections' | 'videos' | 'folder';

export interface NavItem {
  id: string;
  label: string;
  to: string;
  icon: NavIcon;
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
