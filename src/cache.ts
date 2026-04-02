import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'fs';
import { join } from 'path';
import { CACHE_DIR, MS_PER_HOUR, DEFAULT_TIME_HOURS } from './constants.js';

/**
 * Read cached version if valid.
 * Cache TTL now follows the safety window (timeMs).
 */
export function getCachedVersion(pkgName: string, ttlMs: number = DEFAULT_TIME_HOURS * MS_PER_HOUR): string | null {
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
 * Write version to cache atomically to prevent corruption during concurrent writes.
 */
export function setCachedVersion(pkgName: string, version: string): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  const cacheFile = join(CACHE_DIR, `${pkgName.replaceAll('/', '--')}.json`);
  const tmpFile = `${cacheFile}.${process.pid}.${Date.now()}.tmp`;

  // Atomic write: write to temp file, then rename
  writeFileSync(tmpFile, JSON.stringify({ version, resolvedAt: Date.now() }));
  renameSync(tmpFile, cacheFile);
}
