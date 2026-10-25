// Jellymorph plugin interface v1 (docs/themes.md §12): `react` for plugin themes.
// A plugin's build points this import here, so it shares the app's own copy. Keep the names
// in step with src/plugin-api (checked by src/plugin-api/plugin-api.test.ts).
const api = globalThis.__jellymorph?.v1;
if (!api) throw new Error('The Jellymorph plugin interface v1 is not available.');

export default api.react;
export const {
  Activity,
  Children,
  Component,
  Fragment,
  Profiler,
  PureComponent,
  StrictMode,
  Suspense,
  cache,
  cloneElement,
  createContext,
  createElement,
  createRef,
  forwardRef,
  isValidElement,
  lazy,
  memo,
  startTransition,
  use,
  useActionState,
  useCallback,
  useContext,
  useDebugValue,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  version,
} = api.react;
