import type { Semver, VersionInfo, SafeVersionOptions, SelfUpdateResult } from './types.js';
/**
 * Parse a simple semver string into components.
 * Returns null for invalid or complex prerelease strings.
 */
export declare function parseSemver(version: string): Semver | null;
/**
 * Determine if snpx should intercept version resolution based on package spec.
 * - Exact version (1.5.0) → do not intercept (user knows what they're doing)
 * - Range (^1.0.0, >=1.5) → intercept (uncertainty needs protection)
 * - latest → intercept
 * - No version → intercept
 */
export declare function shouldIntercept(pkgSpec: string | null | undefined): boolean;
/**
 * Find patch fallback version (immediately before latest).
 */
export declare function findPatchFallback(versions: VersionInfo[], latestVersion: string): VersionInfo | null;
/**
 * Find minor fallback version (previous minor line).
 */
export declare function findMinorFallback(versions: VersionInfo[], latestParsed: Semver): VersionInfo | null;
/**
 * Find major fallback version (previous major line).
 */
export declare function findMajorFallback(versions: VersionInfo[], latestParsed: Semver): VersionInfo | null;
/**
 * Resolve a safe version for the package.
 *
 * @param pkgName - Package name
 * @param options - Resolution options
 * @param options.timeMs - Safety window in milliseconds (default: 24h)
 * @param options.strategy - Fallback order, e.g. ['patch','minor','major']
 */
export declare function resolveSafeVersion(pkgName: string, options?: SafeVersionOptions): Promise<string>;
/**
 * Check if snpx itself has an update available.
 * Returns { hasUpdate: boolean, currentVersion: string, latestVersion: string|null }
 */
export declare function checkSelfUpdate(): Promise<SelfUpdateResult>;
