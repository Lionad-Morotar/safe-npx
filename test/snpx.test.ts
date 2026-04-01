import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CACHE_DIR = join(homedir(), '.cache', 'snpx');
const TEST_PKG = 'cowsay';

// Helper to clean test cache
const cleanTestCache = () => {
  const cacheFile = join(CACHE_DIR, `${TEST_PKG}.json`);
  if (existsSync(cacheFile)) {
    rmSync(cacheFile);
  }
};

describe('snpx', () => {
  beforeEach(() => {
    cleanTestCache();
  });

  afterEach(() => {
    cleanTestCache();
  });

  describe('parseArgs', () => {
    it('should parse package@latest pattern', async () => {
      const { parseArgs } = await import('../snpx.js');
      const result = parseArgs(['node', 'snpx', 'cowsay@latest', 'hello']);

      expect(result.pkgSpec).toBe('cowsay@latest');
      expect(result.pkgName).toBe('cowsay');
      expect(result.restArgs).toEqual(['hello']);
    });

    it('should parse scoped package@latest pattern', async () => {
      const { parseArgs } = await import('../snpx.js');
      const result = parseArgs(['node', 'snpx', '@vue/cli@latest', 'create', 'my-app']);

      expect(result.pkgSpec).toBe('@vue/cli@latest');
      expect(result.pkgName).toBe('@vue/cli');
      expect(result.restArgs).toEqual(['create', 'my-app']);
    });

    it('should return null for non-latest packages', async () => {
      const { parseArgs } = await import('../snpx.js');
      const result = parseArgs(['node', 'snpx', 'cowsay@1.0.0', 'hello']);

      expect(result.pkgSpec).toBeNull();
      expect(result.pkgName).toBeNull();
      expect(result.restArgs).toEqual(['cowsay@1.0.0', 'hello']);
    });

    it('should handle flags before package', async () => {
      const { parseArgs } = await import('../snpx.js');
      const result = parseArgs(['node', 'snpx', '-y', 'cowsay@latest', 'hello']);

      expect(result.pkgSpec).toBe('cowsay@latest');
      expect(result.pkgName).toBe('cowsay');
      expect(result.restArgs).toEqual(['-y', 'hello']);
    });
  });

  describe('cache operations', () => {
    const TEST_PKG_EXPIRE = 'cowsay-expire-test';

    beforeEach(() => {
      // Clean all test cache files
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

    it('should write and read cache correctly', async () => {
      const { setCachedVersion, getCachedVersion } = await import('../snpx.js');

      setCachedVersion(TEST_PKG, '1.2.3');
      const version = getCachedVersion(TEST_PKG);

      expect(version).toBe('1.2.3');
    });

    it('should return null for non-existent cache', async () => {
      const { getCachedVersion } = await import('../snpx.js');

      const version = getCachedVersion('non-existent-pkg-12345');

      expect(version).toBeNull();
    });

    it('should return null for expired cache', async () => {
      const { setCachedVersion, getCachedVersion } = await import('../snpx.js');
      const { utimesSync } = await import('fs');

      // Use unique cache file to avoid concurrent test interference
      setCachedVersion(TEST_PKG_EXPIRE, '1.2.3');

      // Touch file with mtime 48 hours ago
      const cacheFile = join(CACHE_DIR, `${TEST_PKG_EXPIRE}.json`);
      const oldTime = new Date(Date.now() - 48 * 60 * 60 * 1000);
      utimesSync(cacheFile, oldTime, oldTime);

      const version = getCachedVersion(TEST_PKG_EXPIRE);
      expect(version).toBeNull();
    });
  });

  describe('resolveSafeVersion', () => {
    it('should fetch package metadata from registry', async () => {
      const { fetchPackageMetadata } = await import('../snpx.js');

      const data = await fetchPackageMetadata('cowsay');

      expect(data).toHaveProperty('name', 'cowsay');
      expect(data).toHaveProperty('dist-tags');
      expect(data).toHaveProperty('time');
      expect(data['dist-tags']).toHaveProperty('latest');
    });

    it('should resolve to a version that is not the latest', async () => {
      const { resolveSafeVersion, fetchPackageMetadata } = await import('../snpx.js');

      // Skip if cowsay latest is too new (no 24h old version available)
      try {
        const version = await resolveSafeVersion('cowsay');
        const data = await fetchPackageMetadata('cowsay');
        const latest = data['dist-tags'].latest;

        expect(version).not.toBe(latest);
        expect(typeof version).toBe('string');
        expect(version).toMatch(/^\d+\.\d+/); // semver format
      } catch (err) {
        // If latest-1 is too new, that's expected behavior
        expect(err.message).toContain('old');
      }
    });

    it('should throw error for non-existent package', async () => {
      const { resolveSafeVersion } = await import('../snpx.js');

      await expect(resolveSafeVersion('non-existent-pkg-12345-abc')).rejects.toThrow();
    });
  });

  describe('self update', () => {
    it('should check for self updates', async () => {
      const { checkSelfUpdate } = await import('../snpx.js');

      const result = await checkSelfUpdate();

      expect(result).toHaveProperty('hasUpdate');
      expect(result).toHaveProperty('currentVersion');
      expect(result).toHaveProperty('latestVersion');
      expect(typeof result.hasUpdate).toBe('boolean');
    });
  });
});
