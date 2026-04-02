import semver from 'semver';
import { fetchPackageMetadata, buildVersionList } from './registry.js';
import { getCachedVersion, setCachedVersion } from './cache.js';
import { VERSION, PKG_NAME, DEFAULT_TIME_HOURS, MS_PER_HOUR, DEFAULT_FALLBACK_STRATEGY } from './constants.js';
import type { Semver, VersionInfo, SafeVersionOptions, SelfUpdateResult } from './types.js';

/**
 * Parse a simple semver string into components.
 * Returns null for invalid or complex prerelease strings.
 */
export function parseSemver(version: string): Semver | null {
  const match = version.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/
  );
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null,
    build: match[5] || null,
    raw: version,
  };
}

/**
 * Determine if snpx should intercept version resolution based on package spec.
 * - Exact version (1.5.0) → do not intercept (user knows what they're doing)
 * - Range (^1.0.0, >=1.5) → intercept (uncertainty needs protection)
 * - latest → intercept
 * - No version → intercept
 */
export function shouldIntercept(pkgSpec: string | null | undefined): boolean {
  if (!pkgSpec) return false;

  // Handle scoped packages (@scope/name@version)
  let versionPart: string | null;
  if (pkgSpec.startsWith('@')) {
    // Find second '@' for scoped packages
    const secondAt = pkgSpec.indexOf('@', 1);
    versionPart = secondAt === -1 ? null : pkgSpec.slice(secondAt + 1);
  } else {
    // Find first '@' for regular packages
    const atIndex = pkgSpec.indexOf('@');
    versionPart = atIndex === -1 ? null : pkgSpec.slice(atIndex + 1);
  }

  // No version specified → intercept
  if (!versionPart) return true;

  // @latest → intercept
  if (versionPart === 'latest') return true;

  // Exact version → do NOT intercept
  if (semver.valid(versionPart)) return false;

  // Range version (^, ~, >, <, etc.) → intercept
  if (semver.validRange(versionPart)) return true;

  // Unknown format → intercept (safe default)
  return true;
}

/**
 * Find patch fallback version (immediately before latest).
 */
export function findPatchFallback(versions: VersionInfo[], latestVersion: string): VersionInfo | null {
  const idx = versions.findIndex((v) => v.version === latestVersion);
  if (idx === -1 || idx + 1 >= versions.length) return null;
  return versions[idx + 1];
}

/**
 * Find minor fallback version (previous minor line).
 */
export function findMinorFallback(versions: VersionInfo[], latestParsed: Semver): VersionInfo | null {
  for (const v of versions) {
    const p = parseSemver(v.version);
    if (p && p.major === latestParsed.major && p.minor < latestParsed.minor) {
      return v;
    }
  }
  return null;
}

/**
 * Find major fallback version (previous major line).
 */
export function findMajorFallback(versions: VersionInfo[], latestParsed: Semver): VersionInfo | null {
  for (const v of versions) {
    const p = parseSemver(v.version);
    if (p && p.major < latestParsed.major) {
      return v;
    }
  }
  return null;
}

/**
 * Resolve a safe version for the package.
 *
 * @param pkgName - Package name
 * @param options - Resolution options
 * @param options.timeMs - Safety window in milliseconds (default: 24h)
 * @param options.strategy - Fallback order, e.g. ['patch','minor','major']
 */
export async function resolveSafeVersion(
  pkgName: string,
  options: SafeVersionOptions = {}
): Promise<string> {
  const timeMs = options.timeMs ?? DEFAULT_TIME_HOURS * MS_PER_HOUR;
  const strategy = options.strategy ?? DEFAULT_FALLBACK_STRATEGY.split(',').map((s) => s.trim());

  const data = await fetchPackageMetadata(pkgName);
  const latestVersion = data['dist-tags']?.latest;
  if (!latestVersion) throw new Error('No latest tag found');

  const latestTimeStr = data.time?.[latestVersion];
  const latestTime = latestTimeStr ? new Date(latestTimeStr).getTime() : null;

  if (!latestTime) {
    throw new Error(
      `Registry did not provide a publish time for ${pkgName}@${latestVersion}. Cannot verify safety window.`
    );
  }

  // If latest itself is old enough, use it directly.
  if (Date.now() - latestTime >= timeMs) {
    return latestVersion;
  }

  const versions = buildVersionList(data);
  const latestParsed = parseSemver(latestVersion);
  if (!latestParsed) throw new Error(`Unable to parse latest version ${latestVersion}`);

  for (const strat of strategy) {
    let candidate: VersionInfo | null = null;
    if (strat === 'patch') {
      candidate = findPatchFallback(versions, latestVersion);
    } else if (strat === 'minor') {
      candidate = findMinorFallback(versions, latestParsed);
    } else if (strat === 'major') {
      candidate = findMajorFallback(versions, latestParsed);
    }

    if (candidate && Date.now() - candidate.time >= timeMs) {
      return candidate.version;
    }
  }

  throw new Error(
    `Could not find a safe version for ${pkgName} within strategy [${strategy.join(',')}] and time window ${Math.floor(
      timeMs / MS_PER_HOUR
    )}h`
  );
}

/**
 * Check if snpx itself has an update available.
 * Returns { hasUpdate: boolean, currentVersion: string, latestVersion: string|null }
 */
export async function checkSelfUpdate(): Promise<SelfUpdateResult> {
  try {
    const data = await fetchPackageMetadata(PKG_NAME);
    const latest = data['dist-tags']?.latest;
    if (!latest) return { hasUpdate: false, currentVersion: VERSION, latestVersion: null };

    const hasUpdate = latest !== VERSION;

    return { hasUpdate, currentVersion: VERSION, latestVersion: latest };
  } catch {
    return { hasUpdate: false, currentVersion: VERSION, latestVersion: null };
  }
}
