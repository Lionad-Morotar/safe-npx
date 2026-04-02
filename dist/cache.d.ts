/**
 * Read cached version if valid.
 * Cache TTL now follows the safety window (timeMs).
 */
export declare function getCachedVersion(pkgName: string, ttlMs?: number): string | null;
/**
 * Write version to cache atomically to prevent corruption during concurrent writes.
 */
export declare function setCachedVersion(pkgName: string, version: string): void;
