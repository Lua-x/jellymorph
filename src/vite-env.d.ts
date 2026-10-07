/// <reference types="vite/client" />

/** Version from package.json, injected at build time. */
declare const __APP_VERSION__: string;

interface Window {
  /** Runtime configuration written by the container entrypoint (see public config.js). */
  __APP_CONFIG__?: unknown;
}
