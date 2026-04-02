/**
 * Type definitions for safe-npx (snpx)
 */

export interface Semver {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
  build: string | null;
  raw: string;
}

export interface SnpxFlags {
  help: boolean;
  version: boolean;
  showVersion: boolean;
  selfUpdate: boolean;
  unsafeSelfUpdate: boolean;
  time: string | null;
  fallbackStrategy: string | null;
}

export interface ParsedArgs {
  snpxFlags: SnpxFlags;
  pkgSpec: string | null;
  pkgName: string | null;
  npxPrefixArgs: string[];  // npx flags that go BEFORE package (e.g., -y)
  restArgs: string[];       // args that go AFTER package
  isLatest: boolean;
}

export interface VersionInfo {
  version: string;
  time: number;
}

export interface SafeVersionOptions {
  timeMs?: number;
  strategy?: string[];
}

export interface SelfUpdateResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string | null;
}

export interface FetchOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  timeout?: number;
}

/**
 * Parse a simple semver string into components.
 * Returns null for invalid or complex prerelease strings.
 */
export function parseSemver(version: string): Semver | null;

/**
 * Determine if snpx should intercept version resolution based on package spec.
 * - Exact version (1.5.0) → do not intercept (user knows what they're doing)
 * - Range (^1.0.0, >=1.5) → intercept (uncertainty needs protection)
 * - latest → intercept
 * - No version → intercept
 */
export function shouldIntercept(pkgSpec: string | null | undefined): boolean;

/**
 * Extract package name from spec.
 * @example 'cowsay@1.5.0' → 'cowsay'
 * @example '@vue/cli@latest' → '@vue/cli'
 */
export function extractPackageName(pkgSpec: string | null | undefined): string | null;

/**
 * Parse CLI arguments using two-phase parsing.
 */
export function parseArgs(argv: string[]): ParsedArgs;

/**
 * Read cached version if valid.
 */
export function getCachedVersion(pkgName: string, ttlMs?: number): string | null;

/**
 * Write version to cache atomically.
 */
export function setCachedVersion(pkgName: string, version: string): void;

/**
 * Fetch package metadata from registry with retry logic.
 */
export function fetchPackageMetadata(pkgName: string, options?: FetchOptions): Promise<any>;

/**
 * Build version list from registry data.
 */
export function buildVersionList(data: any): VersionInfo[];

/**
 * Find patch fallback version (immediately before latest).
 */
export function findPatchFallback(versions: VersionInfo[], latestVersion: string): VersionInfo | null;

/**
 * Find minor fallback version (previous minor line).
 */
export function findMinorFallback(versions: VersionInfo[], latestParsed: Semver): VersionInfo | null;

/**
 * Find major fallback version (previous major line).
 */
export function findMajorFallback(versions: VersionInfo[], latestParsed: Semver): VersionInfo | null;

/**
 * Resolve a safe version for the package.
 */
export function resolveSafeVersion(pkgName: string, options?: SafeVersionOptions): Promise<string>;

/**
 * Check if snpx itself has an update available.
 */
export function checkSelfUpdate(): Promise<SelfUpdateResult>;

/**
 * Build effective execution options from CLI flags and environment variables.
 */
export function buildOptions(snpxFlags: Partial<SnpxFlags>): {
  timeHours: string | number;
  timeMs: number;
  strategy: string[];
};
