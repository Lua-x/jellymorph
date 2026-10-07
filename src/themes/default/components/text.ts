import type { TFunction } from 'i18next';
import type { AppError, ServerProblem } from '@/domain/types';

/** Title and explanation for an error, from the "errors" namespace. */
export function errorText(
  t: TFunction<'errors'>,
  error: AppError,
): { title: string; message: string } {
  return { title: t(`${error.kind}.title`), message: t(`${error.kind}.message`) };
}

export function serverProblemText(
  t: TFunction<'auth'>,
  problem: ServerProblem,
  minimumVersion: string,
): string {
  switch (problem.reason) {
    case 'invalidAddress':
      return t('server.problems.invalidAddress');
    case 'unreachable':
      return t('server.problems.unreachable');
    case 'notJellyfin':
      return t('server.problems.notJellyfin');
    case 'setupIncomplete':
      return t('server.problems.setupIncomplete');
    case 'unsupportedVersion':
      return t('server.problems.unsupportedVersion', {
        version: problem.version,
        minimum: minimumVersion,
      });
  }
}

/** Host part of a server URL for compact display. */
export function hostOf(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.length > 1 ? `${parsed.host}${parsed.pathname}` : parsed.host;
  } catch {
    return url;
  }
}
