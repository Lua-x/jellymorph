/**
 * Shown when the app cannot start at all (e.g. the demo service worker is unavailable).
 * At this point translations may not be loaded, so the two languages live here.
 */
const MESSAGES = {
  de: {
    title: 'Jellymorph konnte nicht starten.',
    demo: 'Der Demo-Modus braucht einen Service Worker. Öffne die App über HTTPS oder localhost.',
    generic: 'Lade die Seite neu. Wenn der Fehler bleibt, prüfe die Container-Konfiguration.',
  },
  en: {
    title: 'Jellymorph could not start.',
    demo: 'Demo mode needs a service worker. Open the app via HTTPS or localhost.',
    generic: 'Reload the page. If the error persists, check the container configuration.',
  },
} as const;

export class DemoUnavailableError extends Error {
  constructor(cause: unknown) {
    super('Demo mode is unavailable', { cause });
    this.name = 'DemoUnavailableError';
  }
}

export function renderBootError(container: HTMLElement, error: unknown): void {
  console.error(error);
  const language = navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en';
  const messages = MESSAGES[language];
  const wrapper = document.createElement('div');
  wrapper.className = 'boot-error';
  wrapper.setAttribute('role', 'alert');
  const content = document.createElement('div');
  const title = document.createElement('h1');
  title.textContent = messages.title;
  const detail = document.createElement('p');
  detail.textContent = error instanceof DemoUnavailableError ? messages.demo : messages.generic;
  content.append(title, detail);
  wrapper.append(content);
  container.replaceChildren(wrapper);
}
