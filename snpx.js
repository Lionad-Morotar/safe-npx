#!/usr/bin/env node
/**
 * safe-npx (snpx) - Lock npx to latest-1 version with 24h cache
 * Inspired by safe-npm: https://github.com/kevinslin/safe-npm
 */

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CACHE_DIR = join(homedir(), '.cache', 'snpx');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MIN_AGE_MS = 24 * 60 * 60 * 1000; // 1 day
const REGISTRY = 'https://registry.npmjs.org';
const PKG_NAME = '@lionad/safe-npx';

const HELP_TEXT = `
safe-npx (snpx) - Lock npx to latest-1 version with 24h cache

Usage:
  snpx [options] <package>@latest [args...]
  snpx [options] <command>

Options:
  -h, --help                Show this help message
  --self-update             Check for snpx updates (safe mode, default)
  --unsafe-self-update      Allow immediate snpx updates without 24h delay

Examples:
  snpx -y cowsay@latest "Hello World"
  snpx --self-update

Note: Only calls containing @latest are intercepted. Other commands pass through to npx directly.
`.trim();

/**
 * Parse package specifier from argv
 * Returns { pkgSpec: string|null, pkgName: string|null, restArgs: string[] }
 * Only intercepts specs containing '@latest'
 */
export function parseArgs(argv) {
  const args = argv.slice(2);
  let pkgSpec = null;
  let pkgName = null;
  let restArgs = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    // Match package@latest pattern (including scoped @scope/pkg@latest)
    const match = arg.match(/^(@[^/]+\/[^@]+|[^@]+)@latest$/);
    if (match && !pkgSpec) {
      pkgSpec = arg;
      pkgName = match[1];
    } else {
      restArgs.push(arg);
    }
  }

  return { pkgSpec, pkgName, restArgs };
}

/**
 * Read cached version if valid
 */
export function getCachedVersion(pkgName) {
  const cacheFile = join(CACHE_DIR, `${pkgName.replace('/', '--')}.json`);
  if (!existsSync(cacheFile)) return null;

  try {
    const stat = statSync(cacheFile);
    const age = Date.now() - stat.mtimeMs;
    if (age > CACHE_TTL_MS) return null;

    const data = JSON.parse(readFileSync(cacheFile, 'utf8'));
    return data.version;
  } catch {
    return null;
  }
}

/**
 * Write version to cache
 */
export function setCachedVersion(pkgName, version) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const cacheFile = join(CACHE_DIR, `${pkgName.replace('/', '--')}.json`);
  writeFileSync(cacheFile, JSON.stringify({ version, resolvedAt: Date.now() }));
}

/**
 * Fetch package metadata from registry
 */
export async function fetchPackageMetadata(pkgName) {
  const url = `${REGISTRY}/${encodeURIComponent(pkgName)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Failed to fetch ${pkgName}: ${res.status}`);
  return res.json();
}

/**
 * Find latest-1 version that is at least 1 day old
 */
export async function resolveSafeVersion(pkgName) {
  const data = await fetchPackageMetadata(pkgName);
  const latest = data['dist-tags']?.latest;
  if (!latest) throw new Error('No latest tag found');

  const times = data.time || {};
  const versions = Object.entries(times)
    .filter(([v]) => v !== 'created' && v !== 'modified')
    .map(([v, t]) => ({ version: v, time: new Date(t).getTime() }))
    .sort((a, b) => b.time - a.time); // Descending by time

  // Find index of latest
  const latestIdx = versions.findIndex(v => v.version === latest);
  if (latestIdx === -1) throw new Error('Latest version not found in time data');

  // Get previous version (latest-1)
  const prev = versions[latestIdx + 1];
  if (!prev) throw new Error('No previous version available');

  // Check age
  const age = Date.now() - prev.time;
  if (age < MIN_AGE_MS) {
    throw new Error(`Previous version ${prev.version} is only ${Math.floor(age / 3600000)}h old, need 24h`);
  }

  return prev.version;
}

/**
 * Check if snpx itself has an update available
 * Returns { hasUpdate: boolean, currentVersion: string, latestVersion: string|null }
 */
export async function checkSelfUpdate() {
  try {
    const data = await fetchPackageMetadata(PKG_NAME);
    const latest = data['dist-tags']?.latest;
    if (!latest) return { hasUpdate: false, currentVersion: '0.1.0', latestVersion: null };

    const currentVersion = '0.1.0'; // Should match package.json
    const hasUpdate = latest !== currentVersion;

    return { hasUpdate, currentVersion, latestVersion: latest };
  } catch {
    return { hasUpdate: false, currentVersion: '0.1.0', latestVersion: null };
  }
}

/**
 * Run npx with proper exit code handling
 */
function runNpx(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', args, { stdio: 'inherit' });
    child.on('close', (code) => {
      process.exitCode = code ?? 0;
      resolve();
    });
    child.on('error', reject);
  });
}
/**
 * Main entry
 */
async function main() {
  const args = process.argv.slice(2);

  // Handle help
  if (args.includes('-h') || args.includes('--help')) {
    console.log(HELP_TEXT);
    return;
  }

  // Handle self-update check
  const selfUpdateIndex = args.findIndex(a => a === '--self-update');
  const unsafeSelfUpdateIndex = args.findIndex(a => a === '--unsafe-self-update');

  if (selfUpdateIndex !== -1 || unsafeSelfUpdateIndex !== -1) {
    const unsafe = unsafeSelfUpdateIndex !== -1;
    console.error(`[snpx] Checking for updates${unsafe ? ' (unsafe mode)' : ''}...`);

    try {
      const { hasUpdate, currentVersion, latestVersion } = await checkSelfUpdate();

      if (!latestVersion) {
        console.error('[snpx] Could not check for updates. Try again later.');
        process.exit(1);
      }

      if (hasUpdate) {
        console.error(`[snpx] Update available: ${currentVersion} → ${latestVersion}`);
        console.error('[snpx] Run: npm update -g @lionad/safe-npx');

        if (!unsafe) {
          // Safe mode: check if latest is 24h old
          const data = await fetchPackageMetadata(PKG_NAME);
          const times = data.time || {};
          const latestTime = times[latestVersion];
          if (latestTime) {
            const age = Date.now() - new Date(latestTime).getTime();
            if (age < MIN_AGE_MS) {
              console.error(`[snpx] Warning: Latest version is only ${Math.floor(age / 3600000)}h old. Waiting for 24h safety window.`);
              console.error('[snpx] Use --unsafe-self-update to bypass (not recommended)');
            }
          }
        }
      } else {
        console.error(`[snpx] Already up to date (${currentVersion})`);
      }
    } catch (err) {
      console.error(`[snpx] Error checking for updates: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // Normal package execution flow
  const { pkgSpec, pkgName, restArgs } = parseArgs(process.argv);

  // No @latest found, pass through directly
  if (!pkgSpec || !pkgName) {
    await runNpx(args);
    return;
  }

  // Check cache first
  let version = getCachedVersion(pkgName);

  if (!version) {
    console.error(`[snpx] Resolving safe version for ${pkgName}...`);
    try {
      version = await resolveSafeVersion(pkgName);
      setCachedVersion(pkgName, version);
      console.error(`[snpx] Using ${pkgName}@${version} (latest-1, cached for 24h)`);
    } catch (err) {
      console.error(`[snpx] Error: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.error(`[snpx] Using cached ${pkgName}@${version}`);
  }

  // Replace @latest with @version and spawn npx
  const npxArgs = [`${pkgName}@${version}`, ...restArgs];
  await runNpx(npxArgs);
}

main().catch(err => {
  console.error(`[snpx] Fatal: ${err.message}`);
  process.exit(1);
});
