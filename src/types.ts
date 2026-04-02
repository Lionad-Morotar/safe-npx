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

export interface CliOptions {
  timeHours: string | number;
  timeMs: number;
  strategy: string[];
}
