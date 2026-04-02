#!/usr/bin/env node
/**
 * safe-npx (snpx) - Safe npx wrapper with configurable fallback strategy
 */
export { parseArgs, buildOptions, HELP_TEXT } from './cli.js';
export { getCachedVersion, setCachedVersion } from './cache.js';
export { fetchPackageMetadata, buildVersionList } from './registry.js';
export { parseSemver, shouldIntercept, findPatchFallback, findMinorFallback, findMajorFallback, resolveSafeVersion, checkSelfUpdate, } from './version.js';
export { VERSION, CACHE_DIR, REGISTRY, PKG_NAME, DEFAULT_TIME_HOURS, DEFAULT_FALLBACK_STRATEGY, MS_PER_HOUR } from './constants.js';
export type * from './types.js';
