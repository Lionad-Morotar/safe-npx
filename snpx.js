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

/**
 * Parse package specifier from argv
 * Returns { pkgSpec: string|null, pkgName: string|null, restArgs: string[] }
 * Only intercepts specs containing '@latest'
 */
function parseArgs(argv) {
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
function getCachedVersion(pkgName) {
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
function setCachedVersion(pkgName, version) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const cacheFile = join(CACHE_DIR, `${pkgName.replace('/', '--')}.json`);
  writeFileSync(cacheFile, JSON.stringify({ version, resolvedAt: Date.now() }));
}

/**
 * Fetch package metadata from registry
 */
async function fetchPackageMetadata(pkgName) {
  const url = `${REGISTRY}/${encodeURIComponent(pkgName)}`;
  const res = await fetch(url, { timeout: 10000 });
  if (!res.ok) throw new Error(`Failed to fetch ${pkgName}: ${res.status}`);
  return res.json();
}

/**
 * Find latest-1 version that is at least 1 day old
 */
async function resolveSafeVersion(pkgName) {
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
 * Main entry
 */
async function main() {
  const { pkgSpec, pkgName, restArgs } = parseArgs(process.argv);

  // No @latest found, pass through directly
  if (!pkgSpec || !pkgName) {
    const args = process.argv.slice(2);
    spawn('npx', args, { stdio: 'inherit' });
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
  spawn('npx', npxArgs, { stdio: 'inherit' });
}

main().catch(err => {
  console.error(`[snpx] Fatal: ${err.message}`);
  process.exit(1);
});
