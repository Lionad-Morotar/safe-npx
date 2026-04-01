#!/usr/bin/env node
/**
 * safe-npx (snpx) - Safe npx wrapper with configurable fallback strategy
 */

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CACHE_DIR = join(homedir(), '.cache', 'snpx');
const REGISTRY = 'https://registry.npmjs.org';
const PKG_NAME = '@lionad/safe-npx';
const DEFAULT_TIME_HOURS = 24;
const DEFAULT_FALLBACK_STRATEGY = 'patch,minor,major';
const MS_PER_HOUR = 60 * 60 * 1000;

const _tty = process.stdout.isTTY && !process.env.NO_COLOR;
const _c = {
  bold: (s) => _tty ? `\x1b[1m${s}\x1b[22m` : s,
  dim: (s) => _tty ? `\x1b[2m${s}\x1b[22m` : s,
  green: (s) => _tty ? `\x1b[32m${s}\x1b[39m` : s,
  cyan: (s) => _tty ? `\x1b[36m${s}\x1b[39m` : s,
  yellow: (s) => _tty ? `\x1b[33m${s}\x1b[39m` : s,
};

const HELP_TEXT = `
${_c.bold(_c.cyan('safe-npx (snpx)'))} — Safe npx wrapper with configurable fallback strategy

${_c.bold('Usage:')}
  ${_c.green('snpx')} [options] <package>@latest [args...]
  ${_c.green('snpx')} [options] <package> [args...]
  ${_c.green('snpx')} [options] <command>

${_c.bold('Options:')}
  ${_c.yellow('-h, --help')}                Show this help message
  ${_c.yellow('--time')} ${_c.dim('<hours>')}            Safety window in hours (default: 24)
  ${_c.yellow('--fallback-strategy')} ${_c.dim('<str>')} Comma-separated fallback order.
                            Default: patch,minor,major
                            Left-to-right: first matching safe version wins.
                            ${_c.dim('patch')}  = version immediately before latest
                            ${_c.dim('minor')}  = most recently published version of previous minor line
                            ${_c.dim('major')}  = most recently published version of previous major line
  ${_c.yellow('--show-version')}            Print resolved version and exit (no execution)
  ${_c.yellow('--self-update')}             Check for snpx updates (safe mode, default 24h)
  ${_c.yellow('--unsafe-self-update')}      Allow immediate snpx updates without safety window

${_c.bold('Environment Variables:')}
  ${_c.green('SNPX_TIME')}                 Default for --time
  ${_c.green('SNPX_FALLBACK_STRATEGY')}    Default for --fallback-strategy

${_c.bold('Examples:')}
  ${_c.green('snpx')} -y cowsay@latest "Hello World"
  ${_c.green('snpx')} --time 48 --fallback-strategy patch,minor cowsay@latest
  ${_c.green('snpx')} --show-version cowsay@latest
  ${_c.green('snpx')} cowsay@latest --version               ${_c.dim('# passes --version to cowsay')}
`.trim();

/**
 * Parse a simple semver string into components.
 * Returns null for invalid or complex prerelease strings.
 */
export function parseSemver(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null,
    build: match[5] || null,
    raw: version
  };
}

/**
 * Parse CLI arguments using two-phase parsing:
 *
 *   Phase 1 (before package): Only snpx flags accepted.
 *     Unknown --flags → error. Single-dash flags (-y) → npx passthrough.
 *   Phase 2 (after package): Everything is passthrough to the executed tool.
 *
 *   snpx [snpx-flags] <package> [tool-args...]
 *   snpx [snpx-flags]                (--help, --self-update, etc.)
 */
export function parseArgs(argv) {
  const args = argv.slice(2);
  const snpxFlags = {
    help: false,
    showVersion: false,
    selfUpdate: false,
    unsafeSelfUpdate: false,
    time: null,
    fallbackStrategy: null,
  };
  let pkgSpec = null;
  let pkgName = null;
  const restArgs = [];
  let foundPackage = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Phase 2: after package name, everything is passthrough
    if (foundPackage) {
      restArgs.push(arg);
      continue;
    }

    // Phase 1: before package, only known snpx flags accepted
    if (arg === '-h' || arg === '--help') {
      snpxFlags.help = true;
    } else if (arg === '--show-version') {
      snpxFlags.showVersion = true;
    } else if (arg === '--self-update') {
      snpxFlags.selfUpdate = true;
    } else if (arg === '--unsafe-self-update') {
      snpxFlags.unsafeSelfUpdate = true;
    } else if (arg === '--time') {
      if (i + 1 >= args.length) throw new Error('Missing value for --time');
      snpxFlags.time = args[++i];
    } else if (arg.startsWith('--time=')) {
      snpxFlags.time = arg.slice('--time='.length);
    } else if (arg === '--fallback-strategy') {
      if (i + 1 >= args.length) throw new Error('Missing value for --fallback-strategy');
      snpxFlags.fallbackStrategy = args[++i];
    } else if (arg.startsWith('--fallback-strategy=')) {
      snpxFlags.fallbackStrategy = arg.slice('--fallback-strategy='.length);
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown flag: ${arg}. Run 'snpx --help' for available options.`);
    } else if (arg.startsWith('-')) {
      // Single-dash npx flags (e.g. -y, -p) are always passthrough
      restArgs.push(arg);
    } else {
      // Positional: check if it's a package name
      const latestMatch = arg.match(/^(@[^/]+\/[^@]+|[^@]+)@latest$/);
      if (latestMatch) {
        pkgSpec = arg;
        pkgName = latestMatch[1];
        foundPackage = true;
      } else {
        const bareMatch = arg.match(/^(@[^/]+\/[^@]+|[^@]+)$/);
        if (bareMatch) {
          pkgSpec = arg;
          pkgName = bareMatch[1];
          foundPackage = true;
        } else {
          // Not a recognized package spec (e.g. pkg@1.0.0).
          // Stop phase 1; treat this and everything after as npx passthrough.
          foundPackage = true;
          restArgs.push(arg);
        }
      }
    }
  }

  return { snpxFlags, pkgSpec, pkgName, restArgs, isLatest: !!(pkgSpec && pkgSpec.includes('@latest')) };
}

/**
 * Read cached version if valid.
 * Cache TTL now follows the safety window (timeMs).
 */
export function getCachedVersion(pkgName, ttlMs = DEFAULT_TIME_HOURS * MS_PER_HOUR) {
  const cacheFile = join(CACHE_DIR, `${pkgName.replaceAll('/', '--')}.json`);
  if (!existsSync(cacheFile)) return null;

  try {
    const data = JSON.parse(readFileSync(cacheFile, 'utf8'));
    const age = Date.now() - (data.resolvedAt || 0);
    if (age > ttlMs) return null;
    return data.version;
  } catch {
    return null;
  }
}

/**
 * Write version to cache.
 */
export function setCachedVersion(pkgName, version) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const cacheFile = join(CACHE_DIR, `${pkgName.replaceAll('/', '--')}.json`);
  writeFileSync(cacheFile, JSON.stringify({ version, resolvedAt: Date.now() }));
}

/**
 * Fetch package metadata from registry.
 */
export async function fetchPackageMetadata(pkgName) {
  const url = `${REGISTRY}/${encodeURIComponent(pkgName)}`;
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Failed to fetch ${pkgName}: ${res.status}`);
  return res.json();
}

export function buildVersionList(data) {
  return Object.entries(data.time || {})
    .filter(([v]) => v !== 'created' && v !== 'modified')
    .map(([v, t]) => ({ version: v, time: new Date(t).getTime() }))
    .filter(v => !Number.isNaN(v.time))
    .sort((a, b) => b.time - a.time);
}

export function findPatchFallback(versions, latestVersion) {
  const idx = versions.findIndex(v => v.version === latestVersion);
  if (idx === -1 || idx + 1 >= versions.length) return null;
  return versions[idx + 1];
}

export function findMinorFallback(versions, latestParsed) {
  for (const v of versions) {
    const p = parseSemver(v.version);
    if (p && p.major === latestParsed.major && p.minor < latestParsed.minor) {
      return v;
    }
  }
  return null;
}

export function findMajorFallback(versions, latestParsed) {
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
 * @param {string} pkgName
 * @param {object} options
 * @param {number} options.timeMs - Safety window in milliseconds (default: 24h)
 * @param {string[]} options.strategy - Fallback order, e.g. ['patch','minor','major']
 */
export async function resolveSafeVersion(pkgName, options = {}) {
  const timeMs = options.timeMs ?? DEFAULT_TIME_HOURS * MS_PER_HOUR;
  const strategy = options.strategy ?? DEFAULT_FALLBACK_STRATEGY.split(',').map(s => s.trim());

  const data = await fetchPackageMetadata(pkgName);
  const latestVersion = data['dist-tags']?.latest;
  if (!latestVersion) throw new Error('No latest tag found');

  const latestTimeStr = data.time?.[latestVersion];
  const latestTime = latestTimeStr ? new Date(latestTimeStr).getTime() : null;

  if (!latestTime) {
    throw new Error(`Registry did not provide a publish time for ${pkgName}@${latestVersion}. Cannot verify safety window.`);
  }

  // If latest itself is old enough, use it directly.
  if ((Date.now() - latestTime) >= timeMs) {
    return latestVersion;
  }

  const versions = buildVersionList(data);
  const latestParsed = parseSemver(latestVersion);
  if (!latestParsed) throw new Error(`Unable to parse latest version ${latestVersion}`);

  for (const strat of strategy) {
    let candidate = null;
    if (strat === 'patch') {
      candidate = findPatchFallback(versions, latestVersion);
    } else if (strat === 'minor') {
      candidate = findMinorFallback(versions, latestParsed);
    } else if (strat === 'major') {
      candidate = findMajorFallback(versions, latestParsed);
    }

    if (candidate && (Date.now() - candidate.time) >= timeMs) {
      return candidate.version;
    }
  }

  throw new Error(`Could not find a safe version for ${pkgName} within strategy [${strategy.join(',')}] and time window ${Math.floor(timeMs / MS_PER_HOUR)}h`);
}

/**
 * Check if snpx itself has an update available.
 * Returns { hasUpdate: boolean, currentVersion: string, latestVersion: string|null }
 */
export async function checkSelfUpdate() {
  try {
    const data = await fetchPackageMetadata(PKG_NAME);
    const latest = data['dist-tags']?.latest;
    if (!latest) return { hasUpdate: false, currentVersion: '0.2.3', latestVersion: null };

    const currentVersion = '0.2.3'; // Should match package.json
    const hasUpdate = latest !== currentVersion;

    return { hasUpdate, currentVersion, latestVersion: latest };
  } catch {
    return { hasUpdate: false, currentVersion: '0.2.3', latestVersion: null };
  }
}

/**
 * Run npx with proper exit code handling.
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
 * Build effective execution options from CLI flags and environment variables.
 */
export function buildOptions(snpxFlags) {
  const envTime = process.env.SNPX_TIME;
  const envStrategy = process.env.SNPX_FALLBACK_STRATEGY;
  const timeHours = snpxFlags.time ?? envTime ?? DEFAULT_TIME_HOURS;
  const parsedHours = parseFloat(timeHours);
  if (!Number.isFinite(parsedHours) || parsedHours < 0) {
    console.error(`[snpx] Invalid --time value: ${timeHours}`);
    process.exit(1);
  }
  const timeMs = parsedHours * MS_PER_HOUR;
  const strategyStr = snpxFlags.fallbackStrategy ?? envStrategy ?? DEFAULT_FALLBACK_STRATEGY;
  const strategy = strategyStr.split(',').map(s => s.trim()).filter(Boolean);
  return { timeHours, timeMs, strategy };
}

/**
 * Main entry
 */
async function main() {
  const { snpxFlags, pkgSpec, pkgName, restArgs } = parseArgs(process.argv);

  if (snpxFlags.help) {
    console.log(HELP_TEXT);
    return;
  }

  const { timeHours, timeMs, strategy } = buildOptions(snpxFlags);

  // Handle self-update check.
  const selfUpdate = snpxFlags.selfUpdate;
  const unsafeSelfUpdate = snpxFlags.unsafeSelfUpdate;

  if (selfUpdate || unsafeSelfUpdate) {
    const unsafe = unsafeSelfUpdate;
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
          const data = await fetchPackageMetadata(PKG_NAME);
          const times = data.time || {};
          const latestTime = times[latestVersion];
          if (latestTime) {
            const age = Date.now() - new Date(latestTime).getTime();
            if (age < timeMs) {
              console.error(`[snpx] Warning: Latest version is only ${Math.floor(age / MS_PER_HOUR)}h old. Waiting for ${timeHours}h safety window.`);
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

  // Normal package execution flow.
  // No package specifier found -> pass through to npx (but strip snpx flags).
  if (!pkgSpec || !pkgName) {
    await runNpx(restArgs);
    return;
  }

  // Check cache first.
  let version = getCachedVersion(pkgName, timeMs);

  if (!version) {
    console.error(`[snpx] Resolving safe version for ${pkgName}...`);
    try {
      version = await resolveSafeVersion(pkgName, { timeMs, strategy });
      setCachedVersion(pkgName, version);
      console.error(`[snpx] Using ${pkgName}@${version} (strategy: ${strategy.join(',')}, window: ${timeHours}h)`);
    } catch (err) {
      console.error(`[snpx] Error: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.error(`[snpx] Using cached ${pkgName}@${version}`);
  }

  if (snpxFlags.showVersion) {
    console.log(version);
    return;
  }

  // Replace package specifier with pinned version and spawn npx.
  const npxArgs = [`${pkgName}@${version}`, ...restArgs];
  await runNpx(npxArgs);
}

main().catch(err => {
  console.error(`[snpx] Fatal: ${err.message}`);
  process.exit(1);
});
