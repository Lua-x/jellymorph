/**
 * The module `jellymorph` of the plugin interface, version 1 (phase 17, docs/themes.md §12):
 * the building blocks a plugin theme may use, the same ones the built-in themes use. Everything
 * else in the app is private and may change in any version.
 *
 * Keep public/plugin-api/v1/jellymorph.js in step (checked by plugin-api.test.ts). Only add to
 * this list within version 1; removing or changing something needs a version 2.
 */

// The contract: slots, props, options and the tokens every theme defines.
export { REQUIRED_TOKENS, THEME_CONTRACT_VERSION, THEME_SLOTS } from '@/themes/contract';
export type * from '@/themes/contract';
export type * from '@/domain/types';
export type { NavIcon, NavItem, NavModel } from '@/navigation/nav-model';
export type { DetailLayout } from '@/hooks/useLayout';
export type { PlayerModel } from '@/player/model';
export type { SettingsModel, ThemeChoice } from '@/settings/model';
export { DETAIL_ACTIONS, FACTS, HOME_AREAS } from '@/domain/layout';
export { classicLayout } from '@/themes/default/layout';

// Composition: other slots (Classic stands in for the missing ones) and the active theme.
export { ThemeSlot } from '@/themes/ThemeSlot';
export { useActiveTheme, useThemeOptions } from '@/themes/context';

// Links, pictures and Classic's building blocks.
export { AppLink } from '@/ui/AppLink';
export { JellyImage } from '@/ui/JellyImage';
export { Logo } from '@/ui/Logo';
export { Avatar } from '@/themes/default/components/Avatar';
export { Button } from '@/themes/default/components/Button';
export { Icon } from '@/themes/default/components/icons';
export { Notice } from '@/themes/default/components/Notice';
export { Spinner } from '@/themes/default/components/Spinner';
export { EmptyState, ErrorState, LoadingState } from '@/themes/default/components/States';
export { ExpandableText, ShortList, TrackList } from '@/themes/default/components/Expandable';
export type { ExpandableClasses } from '@/themes/default/components/Expandable';
export { OverflowNav } from '@/themes/default/components/OverflowNav';
export type { OverflowNavClasses } from '@/themes/default/components/OverflowNav';
export { ItemAdmin } from '@/themes/default/components/admin/ItemAdmin';
export type { AdminTriggerProps } from '@/themes/default/components/admin/ItemAdmin';
export { PlayerTimeline } from '@/themes/default/components/PlayerTimeline';
export type { PlayerClasses } from '@/themes/default/components/PlayerTimeline';
export { PlayerMenu } from '@/themes/default/components/PlayerMenus';
export type { PlayerMenuKind } from '@/themes/default/components/PlayerMenus';

// Texts for titles, years, runtimes and errors, as the built-in themes write them.
export {
  cardSubtitle,
  cardTitle,
  episodeCode,
  ratingText,
  runtimeText,
  yearText,
} from '@/themes/default/components/meta';
export { errorText, serverProblemText } from '@/themes/default/components/text';
export { homeIsEmpty, isRow, rowVariant, splitHero } from '@/themes/default/components/home';
export { formatClock } from '@/ui/time';

// Addresses and navigation.
export { linkTo, paths } from '@/navigation/paths';
export { useRouteKey } from '@/navigation/useRouteKey';

// Hooks: actions on titles, motion, device, time, the player's timeline.
export { isPlayable, useMediaActions } from '@/hooks/useMediaActions';
export type { MediaActions, PlayStart } from '@/hooks/useMediaActions';
export { useMotionPreference } from '@/hooks/useMotionPreference';
export { useReducedMotion } from '@/hooks/useReducedMotion';
export { useDeviceKind } from '@/navigation/device';
export { useTrailerPreview } from '@/player/useTrailerPreview';
export type { TrailerPreview } from '@/player/useTrailerPreview';
export { useScrubber } from '@/ui/useScrubber';
export type { Scrubber, ScrubberOptions } from '@/ui/useScrubber';
export { useNow, useSecondsUntil } from '@/hooks/useNow';
export { useLanguage } from '@/hooks/useLanguage';
export { useSessionFlag } from '@/ui/useSessionFlag';
export { useUiSounds } from '@/hooks/useUiSounds';
export { useAppConfig } from '@/config/context';
export { APP_VERSION } from '@/config/version';
