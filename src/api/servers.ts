import {
  ProductNameIssue,
  SystemInfoIssue,
  VersionUnsupportedIssue,
  type RecommendedServerInfo,
} from '@jellyfin/sdk/lib/models';
import { compareVersions } from '@jellyfin/sdk/lib/utils/versioning';
import { MINIMUM_VERSION } from '@jellyfin/sdk/lib/versions';
import type { ServerProblem, ServerSummary } from '@/domain/types';
import { getJellyfin } from './client';

export type ServerCheckResult =
  { ok: true; server: ServerSummary } | ({ ok: false } & ServerProblem);

export { MINIMUM_VERSION };

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function toSummary(info: RecommendedServerInfo): ServerSummary | null {
  const system = info.systemInfo;
  if (!system?.Id || !system.Version) return null;
  const name = system.ServerName?.trim() ?? '';
  return {
    id: system.Id,
    name: name === '' ? new URL(info.address).host : name,
    url: trimTrailingSlash(info.address),
    version: system.Version,
  };
}

function isSupported(version: string): boolean {
  try {
    return compareVersions(version, MINIMUM_VERSION) >= 0;
  } catch {
    return false;
  }
}

function classify(candidates: RecommendedServerInfo[]): ServerCheckResult {
  const reachable = candidates
    .filter((candidate) => candidate.systemInfo?.ProductName === 'Jellyfin Server')
    .sort((a, b) => b.score - a.score || a.responseTime - b.responseTime);

  for (const candidate of reachable) {
    const summary = toSummary(candidate);
    if (!summary) continue;
    if (!isSupported(summary.version)) continue;
    if (candidate.systemInfo?.StartupWizardCompleted === false) {
      return { ok: false, reason: 'setupIncomplete' };
    }
    return { ok: true, server: summary };
  }

  const outdated = candidates
    .flatMap((candidate) => candidate.issues)
    .find((issue): issue is VersionUnsupportedIssue => issue instanceof VersionUnsupportedIssue);
  if (outdated) return { ok: false, reason: 'unsupportedVersion', version: outdated.version };

  const answeredWithoutJellyfin = candidates.some((candidate) =>
    candidate.issues.some((issue) => issue instanceof ProductNameIssue),
  );
  if (answeredWithoutJellyfin) return { ok: false, reason: 'notJellyfin' };

  const allFailed = candidates.every((candidate) =>
    candidate.issues.some((issue) => issue instanceof SystemInfoIssue),
  );
  return { ok: false, reason: allFailed ? 'unreachable' : 'notJellyfin' };
}

/**
 * Checks what the user typed: tries the address variants Jellyfin servers commonly use
 * (https first, default ports), reads /System/Info/Public and verifies the version.
 */
export async function checkServerAddress(input: string): Promise<ServerCheckResult> {
  const value = input.trim();
  if (value === '') return { ok: false, reason: 'invalidAddress' };
  const discovery = getJellyfin().discovery;
  let addresses: string[];
  try {
    addresses = discovery.getAddressCandidates(value);
  } catch {
    return { ok: false, reason: 'invalidAddress' };
  }
  if (addresses.length === 0) return { ok: false, reason: 'invalidAddress' };
  return classify(await discovery.getRecommendedServers(addresses));
}

/** Checks one exact address, used for servers pinned by the deployment. */
export async function checkFixedServer(url: string): Promise<ServerCheckResult> {
  return classify(await getJellyfin().discovery.getRecommendedServers([url]));
}
