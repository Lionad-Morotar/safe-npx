import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync, utimesSync } from 'fs';
import { join } from 'path';
import { CACHE_DIR } from '../src/constants.js';
import { getCachedVersion, setCachedVersion } from '../src/cache.js';

const TEST_PKG = 'cowsay-test';
const TEST_PKG_EXPIRE = 'cowsay-expire-test';

describe('cache', () => {
  beforeEach(() => {
    const cacheFile = join(CACHE_DIR, `${TEST_PKG}.json`);
    const expireCacheFile = join(CACHE_DIR, `${TEST_PKG_EXPIRE}.json`);
    if (existsSync(cacheFile)) rmSync(cacheFile);
    if (existsSync(expireCacheFile)) rmSync(expireCacheFile);
  });

  afterEach(() => {
    const cacheFile = join(CACHE_DIR, `${TEST_PKG}.json`);
    const expireCacheFile = join(CACHE_DIR, `${TEST_PKG_EXPIRE}.json`);
    if (existsSync(cacheFile)) rmSync(cacheFile);
    if (existsSync(expireCacheFile)) rmSync(expireCacheFile);
  });

  it('should write and read cache correctly', () => {
    setCachedVersion(TEST_PKG, '1.2.3');
    const version = getCachedVersion(TEST_PKG);
    expect(version).toBe('1.2.3');
  });

  it('should return null for non-existent cache', () => {
    const version = getCachedVersion('non-existent-pkg-12345');
    expect(version).toBeNull();
  });

  it('should return null for expired cache with custom ttl', () => {
    setCachedVersion(TEST_PKG_EXPIRE, '1.2.3');

    // Rewind resolvedAt to 48 hours ago so ttl of 24h means expired
    const cacheFile = join(CACHE_DIR, `${TEST_PKG_EXPIRE}.json`);
    const oldResolvedAt = Date.now() - 48 * 60 * 60 * 1000;
    writeFileSync(cacheFile, JSON.stringify({ version: '1.2.3', resolvedAt: oldResolvedAt }));

    const version = getCachedVersion(TEST_PKG_EXPIRE, 24 * 60 * 60 * 1000);
    expect(version).toBeNull();
  });

  it('should respect longer custom ttl', () => {
    setCachedVersion(TEST_PKG_EXPIRE, '1.2.3');

    const cacheFile = join(CACHE_DIR, `${TEST_PKG_EXPIRE}.json`);
    const oldTime = new Date(Date.now() - 48 * 60 * 60 * 1000);
    utimesSync(cacheFile, oldTime, oldTime);

    // ttl is 72h -> still valid
    const version = getCachedVersion(TEST_PKG_EXPIRE, 72 * 60 * 60 * 1000);
    expect(version).toBe('1.2.3');
  });

  it('should return null for corrupted cache', () => {
    const cacheFile = join(CACHE_DIR, `${TEST_PKG_EXPIRE}.json`);
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(cacheFile, 'not-json-at-all');

    const version = getCachedVersion(TEST_PKG_EXPIRE);
    expect(version).toBeNull();
  });
});
