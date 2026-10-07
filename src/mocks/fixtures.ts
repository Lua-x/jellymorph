/**
 * Demo data for the mock Jellyfin server. All names are invented; all images are generated
 * (see images.ts). Shapes follow the Jellyfin OpenAPI DTOs.
 */

export const DEMO_SERVER = {
  Id: '9d1c3b7e5f2a4c8e8b6d0a1f2e3c4b5a',
  ServerName: 'Jellymorph Demo',
  Version: '10.11.0',
  ProductName: 'Jellyfin Server',
  OperatingSystem: '',
  LocalAddress: '',
  StartupWizardCompleted: true,
} as const;

export const DEMO_PASSWORD = 'demo';

export interface MockUser {
  id: string;
  name: string;
  /** null = no password set. */
  password: string | null;
  isPublic: boolean;
  imageTag: string | null;
  isAdministrator: boolean;
  /** Hue of the generated avatar. */
  hue: number;
}

export const DEMO_USERS: readonly MockUser[] = [
  {
    id: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
    name: 'Alex',
    password: null,
    isPublic: true,
    imageTag: 'avatar-alex',
    isAdministrator: true,
    hue: 212,
  },
  {
    id: 'b2c3d4e5f60718293a4b5c6d7e8f90a1',
    name: 'Mika',
    password: DEMO_PASSWORD,
    isPublic: true,
    imageTag: 'avatar-mika',
    isAdministrator: false,
    hue: 330,
  },
  {
    id: 'c3d4e5f60718293a4b5c6d7e8f90a1b2',
    name: 'Kim',
    password: DEMO_PASSWORD,
    isPublic: true,
    imageTag: null,
    isAdministrator: false,
    hue: 140,
  },
  {
    id: 'd4e5f60718293a4b5c6d7e8f90a1b2c3',
    name: 'Robin',
    password: DEMO_PASSWORD,
    isPublic: false,
    imageTag: null,
    isAdministrator: false,
    hue: 30,
  },
];

export interface MockView {
  id: string;
  name: string;
  collectionType: string | null;
  hue: number;
}

/** Libraries in the order the server returns them. "Musik" is hidden by the client (v1 scope). */
export const DEMO_VIEWS: readonly MockView[] = [
  { id: 'e1000000000000000000000000000001', name: 'Filme', collectionType: 'movies', hue: 220 },
  { id: 'e1000000000000000000000000000002', name: 'Serien', collectionType: 'tvshows', hue: 280 },
  { id: 'e1000000000000000000000000000003', name: 'Anime', collectionType: 'tvshows', hue: 340 },
  {
    id: 'e1000000000000000000000000000004',
    name: 'Sammlungen',
    collectionType: 'boxsets',
    hue: 40,
  },
  { id: 'e1000000000000000000000000000005', name: 'Musik', collectionType: 'music', hue: 160 },
];
