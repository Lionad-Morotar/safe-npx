#!/usr/bin/env node
/**
 * safe-npx (snpx) - Safe npx wrapper with configurable fallback strategy
 */
import { spawn } from 'child_process';
import { parseArgs, buildOptions, HELP_TEXT } from './cli.js';
import { shouldIntercept, resolveSafeVersion, checkSelfUpdate } from './version.js';
import { getCachedVersion, setCachedVersion } from './cache.js';
import { VERSION, MS_PER_HOUR } from './constants.js';
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
 * Main entry
 */
async function main() {
    const { snpxFlags, pkgSpec, pkgName, npxPrefixArgs, restArgs } = parseArgs(process.argv);
    if (snpxFlags.help) {
        console.log(HELP_TEXT);
        return;
    }
    if (snpxFlags.version) {
        console.log(VERSION);
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
                    const { fetchPackageMetadata } = await import('./registry.js');
                    const { REGISTRY } = await import('./constants.js');
                    const data = await fetchPackageMetadata('@lionad/safe-npx');
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
            }
            else {
                console.error(`[snpx] Already up to date (${currentVersion})`);
            }
        }
        catch (err) {
            console.error(`[snpx] Error checking for updates: ${err.message}`);
            process.exit(1);
        }
        return;
    }
    // Normal package execution flow.
    // No package specifier found -> pass through to npx (but strip snpx flags).
    if (!pkgSpec || !pkgName) {
        await runNpx([...npxPrefixArgs, ...restArgs]);
        return;
    }
    // Determine if we should intercept version resolution
    const needsInterception = shouldIntercept(pkgSpec);
    if (!needsInterception) {
        // Exact version specified - pass through to npx directly
        // User knows exactly what they want
        await runNpx([...npxPrefixArgs, pkgSpec, ...restArgs]);
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
        }
        catch (err) {
            console.error(`[snpx] Error: ${err.message}`);
            process.exit(1);
        }
    }
    else {
        console.error(`[snpx] Using cached ${pkgName}@${version}`);
    }
    if (snpxFlags.showVersion) {
        console.log(version);
        return;
    }
    // Replace package specifier with pinned version and spawn npx.
    // npxPrefixArgs (like -y) must come before the package
    const npxArgs = [`${pkgName}@${version}`, ...restArgs];
    await runNpx(npxArgs);
}
main().catch((err) => {
    console.error(`[snpx] Fatal: ${err.message}`);
    process.exit(1);
});
// Re-exports for testing
export { parseArgs, buildOptions, HELP_TEXT } from './cli.js';
export { getCachedVersion, setCachedVersion } from './cache.js';
export { fetchPackageMetadata, buildVersionList } from './registry.js';
export { parseSemver, shouldIntercept, findPatchFallback, findMinorFallback, findMajorFallback, resolveSafeVersion, checkSelfUpdate, } from './version.js';
export { VERSION, CACHE_DIR, REGISTRY, PKG_NAME, DEFAULT_TIME_HOURS, DEFAULT_FALLBACK_STRATEGY, MS_PER_HOUR } from './constants.js';
//# sourceMappingURL=index.js.map