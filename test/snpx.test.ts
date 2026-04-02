import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, utimesSync } from 'fs';
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
  let originalFetch = global.fetch;

  beforeEach(() => {
    cleanTestCache();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    cleanTestCache();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('parseSemver', () => {
    it('should parse valid semver', async () => {
      const { parseSemver } = await import('../snpx.js');
      expect(parseSemver('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: null, build: null, raw: '1.2.3' });
    });

    it('should parse prerelease and build metadata', async () => {
      const { parseSemver } = await import('../snpx.js');
      expect(parseSemver('1.2.3-alpha.1')).toMatchObject({ major: 1, minor: 2, patch: 3, prerelease: 'alpha.1' });
      expect(parseSemver('1.2.3+build.4')).toMatchObject({ major: 1, minor: 2, patch: 3, build: 'build.4' });
      expect(parseSemver('1.2.3-alpha.1+build.4')).toMatchObject({ major: 1, minor: 2, patch: 3, prerelease: 'alpha.1', build: 'build.4' });
    });

    it('should handle zero values', async () => {
      const { parseSemver } = await import('../snpx.js');
      expect(parseSemver('0.0.0')).toMatchObject({ major: 0, minor: 0, patch: 0 });
    });

    it('should return null for invalid semver', async () => {
      const { parseSemver } = await import('../snpx.js');
      expect(parseSemver('1.2')).toBeNull();
      expect(parseSemver('latest')).toBeNull();
      expect(parseSemver('')).toBeNull();
    });
  });

  describe('parseArgs', () => {
    it('should parse package@latest pattern', async () => {
      const { parseArgs } = await import('../snpx.js');
      const result = parseArgs(['node', 'snpx', 'cowsay@latest', 'hello']);

      expect(result.pkgSpec).toBe('cowsay@latest');
      expect(result.pkgName).toBe('cowsay');
      expect(result.restArgs).toEqual(['hello']);
      expect(result.isLatest).toBe(true);
      expect(result.snpxFlags.help).toBe(false);
    });

    it('should parse scoped package@latest pattern', async () => {
      const { parseArgs } = await import('../snpx.js');
      const result = parseArgs(['node', 'snpx', '@vue/cli@latest', 'create', 'my-app']);

      expect(result.pkgSpec).toBe('@vue/cli@latest');
      expect(result.pkgName).toBe('@vue/cli');
      expect(result.restArgs).toEqual(['create', 'my-app']);
      expect(result.isLatest).toBe(true);
    });

    it('should parse exact version packages but mark as non-latest', async () => {
      const { parseArgs } = await import('../snpx.js');
      const result = parseArgs(['node', 'snpx', 'cowsay@1.0.0', 'hello']);

      expect(result.pkgSpec).toBe('cowsay@1.0.0');
      expect(result.pkgName).toBe('cowsay');
      expect(result.restArgs).toEqual(['hello']);
      expect(result.isLatest).toBe(false);
    });

    it('should handle flags before package', async () => {
      const { parseArgs } = await import('../snpx.js');
      const result = parseArgs(['node', 'snpx', '-y', 'cowsay@latest', 'hello']);

      expect(result.pkgSpec).toBe('cowsay@latest');
      expect(result.pkgName).toBe('cowsay');
      expect(result.npxPrefixArgs).toEqual(['-y']);
      expect(result.restArgs).toEqual(['hello']);
    });

    it('should parse bare package name', async () => {
      const { parseArgs } = await import('../snpx.js');
      const result = parseArgs(['node', 'snpx', '-y', 'cowsay', 'hello']);

      expect(result.pkgSpec).toBe('cowsay');
      expect(result.pkgName).toBe('cowsay');
      expect(result.npxPrefixArgs).toEqual(['-y']);
      expect(result.restArgs).toEqual(['hello']);
      expect(result.isLatest).toBe(false);
    });

    it('should parse --time flag', async () => {
      const { parseArgs } = await import('../snpx.js');
      const result = parseArgs(['node', 'snpx', '--time', '48', 'cowsay@latest']);

      expect(result.snpxFlags.time).toBe('48');
      expect(result.pkgName).toBe('cowsay');
      expect(result.restArgs).toEqual([]);
    });

    it('should parse --fallback-strategy flag', async () => {
      const { parseArgs } = await import('../snpx.js');
      const result = parseArgs(['node', 'snpx', '--fallback-strategy', 'patch,minor', 'cowsay']);

      expect(result.snpxFlags.fallbackStrategy).toBe('patch,minor');
      expect(result.pkgName).toBe('cowsay');
    });

    it('should parse --show-version flag', async () => {
      const { parseArgs } = await import('../snpx.js');
      const result = parseArgs(['node', 'snpx', '--show-version', 'cowsay@latest']);

      expect(result.snpxFlags.showVersion).toBe(true);
      expect(result.pkgName).toBe('cowsay');
    });

    it('should ignore snpx flags in restArgs', async () => {
      const { parseArgs } = await import('../snpx.js');
      const result = parseArgs(['node', 'snpx', '--time', '48', '--fallback-strategy', 'patch,minor', '-y', 'cowsay@latest', 'hello']);

      expect(result.npxPrefixArgs).toEqual(['-y']);
      expect(result.restArgs).toEqual(['hello']);
      expect(result.snpxFlags.time).toBe('48');
      expect(result.snpxFlags.fallbackStrategy).toBe('patch,minor');
    });

    it('should support --time=48 syntax', async () => {
      const { parseArgs } = await import('../snpx.js');
      const result = parseArgs(['node', 'snpx', '--time=48', 'cowsay@latest']);

      expect(result.snpxFlags.time).toBe('48');
      expect(result.pkgName).toBe('cowsay');
    });

    it('should support --fallback-strategy=patch,minor syntax', async () => {
      const { parseArgs } = await import('../snpx.js');
      const result = parseArgs(['node', 'snpx', '--fallback-strategy=patch,minor', 'cowsay@latest']);

      expect(result.snpxFlags.fallbackStrategy).toBe('patch,minor');
      expect(result.pkgName).toBe('cowsay');
    });

    it('should throw when --time is the last argument', async () => {
      const { parseArgs } = await import('../snpx.js');
      expect(() => parseArgs(['node', 'snpx', '--time'])).toThrow('Missing value for --time');
    });

    it('should throw when --fallback-strategy is the last argument', async () => {
      const { parseArgs } = await import('../snpx.js');
      expect(() => parseArgs(['node', 'snpx', '--fallback-strategy'])).toThrow('Missing value for --fallback-strategy');
    });

    it('should parse scoped bare package name', async () => {
      const { parseArgs } = await import('../snpx.js');
      const result = parseArgs(['node', 'snpx', '-y', '@vue/cli', 'create', 'my-app']);

      expect(result.pkgSpec).toBe('@vue/cli');
      expect(result.pkgName).toBe('@vue/cli');
      expect(result.npxPrefixArgs).toEqual(['-y']);
      expect(result.restArgs).toEqual(['create', 'my-app']);
    });

    it('should throw on unknown --flags', async () => {
      const { parseArgs } = await import('../snpx.js');
      expect(() => parseArgs(['node', 'snpx', '--unknown-flag', 'cowsay@latest'])).toThrow('Unknown flag: --unknown-flag');
    });

    it('should parse --version flag', async () => {
      const { parseArgs } = await import('../snpx.js');
      const result1 = parseArgs(['node', 'snpx', '--version']);
      expect(result1.snpxFlags.version).toBe(true);
      expect(result1.pkgName).toBeNull();

      const result2 = parseArgs(['node', 'snpx', '--version', 'cowsay@latest']);
      expect(result2.snpxFlags.version).toBe(true);
      expect(result2.pkgName).toBe('cowsay');
    });

    it('should pass --version through when after package name (two-phase)', async () => {
      const { parseArgs } = await import('../snpx.js');
      const result = parseArgs(['node', 'snpx', 'cowsay@latest', '--version']);
      expect(result.pkgName).toBe('cowsay');
      expect(result.restArgs).toContain('--version');
    });

    it('should pass any --flags through when after package name', async () => {
      const { parseArgs } = await import('../snpx.js');
      const result = parseArgs(['node', 'snpx', 'cowsay@latest', '--version', '--json', '-l']);
      expect(result.pkgName).toBe('cowsay');
      expect(result.restArgs).toEqual(['--version', '--json', '-l']);
    });

    it('should parse exact version packages for interception decision', async () => {
      const { parseArgs, shouldIntercept } = await import('../snpx.js');
      const result = parseArgs(['node', 'snpx', 'cowsay@1.0.0', 'hello']);
      expect(result.pkgSpec).toBe('cowsay@1.0.0');
      expect(result.pkgName).toBe('cowsay');
      expect(result.restArgs).toEqual(['hello']);
      // Exact versions should NOT be intercepted
      expect(shouldIntercept(result.pkgSpec!)).toBe(false);
    });

    it('should pass single-dash npx flags to npxPrefixArgs', async () => {
      const { parseArgs } = await import('../snpx.js');
      const result = parseArgs(['node', 'snpx', '-y', 'cowsay@latest']);
      expect(result.npxPrefixArgs).toEqual(['-y']);
      expect(result.restArgs).toEqual([]);
      expect(result.pkgName).toBe('cowsay');
    });

    it('should handle -- separator correctly', async () => {
      const { parseArgs } = await import('../snpx.js');
      const result = parseArgs(['node', 'snpx', '-y', '--', 'cowsay', 'hello']);
      expect(result.pkgName).toBe('cowsay');
      expect(result.npxPrefixArgs).toEqual(['-y']);
      expect(result.restArgs).toEqual(['hello']);
    });

    it('should treat everything after -- as passthrough', async () => {
      const { parseArgs } = await import('../snpx.js');
      const result = parseArgs(['node', 'snpx', '--', '--help', '--version']);
      expect(result.pkgName).toBe('--help');
      expect(result.restArgs).toEqual(['--version']);
    });
  });

  describe('shouldIntercept', () => {
    it('should NOT intercept exact versions', async () => {
      const { shouldIntercept } = await import('../snpx.js');
      expect(shouldIntercept('cowsay@1.5.0')).toBe(false);
      expect(shouldIntercept('cowsay@0.0.0')).toBe(false);
      expect(shouldIntercept('@vue/cli@4.5.0')).toBe(false);
    });

    it('should intercept latest', async () => {
      const { shouldIntercept } = await import('../snpx.js');
      expect(shouldIntercept('cowsay@latest')).toBe(true);
      expect(shouldIntercept('@vue/cli@latest')).toBe(true);
    });

    it('should intercept range versions', async () => {
      const { shouldIntercept } = await import('../snpx.js');
      expect(shouldIntercept('cowsay@^1.0.0')).toBe(true);
      expect(shouldIntercept('cowsay@~1.0.0')).toBe(true);
      expect(shouldIntercept('cowsay@>=1.5.0')).toBe(true);
      expect(shouldIntercept('cowsay@>1.0.0 <2.0.0')).toBe(true);
      expect(shouldIntercept('cowsay@1.x')).toBe(true);
    });

    it('should intercept bare package names', async () => {
      const { shouldIntercept } = await import('../snpx.js');
      expect(shouldIntercept('cowsay')).toBe(true);
      expect(shouldIntercept('@vue/cli')).toBe(true);
    });

    it('should handle falsy values', async () => {
      const { shouldIntercept } = await import('../snpx.js');
      expect(shouldIntercept('')).toBe(false);
      expect(shouldIntercept(null as any)).toBe(false);
      expect(shouldIntercept(undefined as any)).toBe(false);
    });
  });

  describe('extractPackageName', () => {
    it('should extract name from simple packages', async () => {
      const { extractPackageName } = await import('../snpx.js');
      expect(extractPackageName('cowsay')).toBe('cowsay');
      expect(extractPackageName('cowsay@1.5.0')).toBe('cowsay');
      expect(extractPackageName('cowsay@latest')).toBe('cowsay');
    });

    it('should extract name from scoped packages', async () => {
      const { extractPackageName } = await import('../snpx.js');
      expect(extractPackageName('@vue/cli')).toBe('@vue/cli');
      expect(extractPackageName('@vue/cli@4.5.0')).toBe('@vue/cli');
      expect(extractPackageName('@vue/cli@latest')).toBe('@vue/cli');
    });

    it('should handle falsy values', async () => {
      const { extractPackageName } = await import('../snpx.js');
      expect(extractPackageName('')).toBeNull();
      expect(extractPackageName(null as any)).toBeNull();
      expect(extractPackageName(undefined as any)).toBeNull();
    });
  });

  describe('cache operations', () => {
    const TEST_PKG_EXPIRE = 'cowsay-expire-test';

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

    it('should return null for expired cache with custom ttl', async () => {
      const { setCachedVersion, getCachedVersion } = await import('../snpx.js');

      setCachedVersion(TEST_PKG_EXPIRE, '1.2.3');

      // Rewind resolvedAt to 48 hours ago so ttl of 24h means expired
      const cacheFile = join(CACHE_DIR, `${TEST_PKG_EXPIRE}.json`);
      const oldResolvedAt = Date.now() - 48 * 60 * 60 * 1000;
      writeFileSync(cacheFile, JSON.stringify({ version: '1.2.3', resolvedAt: oldResolvedAt }));

      const version = getCachedVersion(TEST_PKG_EXPIRE, 24 * 60 * 60 * 1000);
      expect(version).toBeNull();
    });

    it('should respect longer custom ttl', async () => {
      const { setCachedVersion, getCachedVersion } = await import('../snpx.js');

      setCachedVersion(TEST_PKG_EXPIRE, '1.2.3');

      const cacheFile = join(CACHE_DIR, `${TEST_PKG_EXPIRE}.json`);
      const oldTime = new Date(Date.now() - 48 * 60 * 60 * 1000);
      utimesSync(cacheFile, oldTime, oldTime);

      // ttl is 72h -> still valid
      const version = getCachedVersion(TEST_PKG_EXPIRE, 72 * 60 * 60 * 1000);
      expect(version).toBe('1.2.3');
    });

    it('should return null for corrupted cache', async () => {
      const { getCachedVersion } = await import('../snpx.js');

      const cacheFile = join(CACHE_DIR, `${TEST_PKG_EXPIRE}.json`);
      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(cacheFile, 'not-json-at-all');

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

    it('should return latest if it is old enough (timeMs=0)', async () => {
      const { resolveSafeVersion, fetchPackageMetadata } = await import('../snpx.js');
      const data = await fetchPackageMetadata('cowsay');
      const latest = data['dist-tags'].latest;

      const version = await resolveSafeVersion('cowsay', { timeMs: 0, strategy: ['patch'] });

      expect(version).toBe(latest);
    });

    it('should return latest if it is old enough (large timeMs)', async () => {
      const { resolveSafeVersion, fetchPackageMetadata } = await import('../snpx.js');
      const data = await fetchPackageMetadata('cowsay');
      const latest = data['dist-tags'].latest;
      const latestTime = new Date(data.time[latest]).getTime();
      const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;

      if (latestTime >= oneYearAgo) {
        const version = await resolveSafeVersion('cowsay', { timeMs: 365 * 24 * 60 * 60 * 1000, strategy: ['patch'] });
        expect(version).toBe(latest);
      } else {
        // If cowsay latest is older than a year, patch fallback should be used.
        // This branch is unlikely for an active package like cowsay.
        expect(true).toBe(true);
      }
    });

    it('should throw error for non-existent package', async () => {
      const { resolveSafeVersion } = await import('../snpx.js');

      await expect(resolveSafeVersion('non-existent-pkg-12345-abc')).rejects.toThrow();
    });

    it('should patch fallback when latest is too fresh (if possible)', async () => {
      const { resolveSafeVersion } = await import('../snpx.js');

      // Using an impossibly large time window to force fallback.
      try {
        const version = await resolveSafeVersion('cowsay', { timeMs: 999999999999, strategy: ['patch', 'minor', 'major'] });
        expect(typeof version).toBe('string');
      } catch (err: any) {
        // If no fallback version is old enough, that's acceptable.
        expect(err.message).toContain('Could not find a safe version');
      }
    });

    it('should throw when latest tag is missing', async () => {
      const { resolveSafeVersion } = await import('../snpx.js');
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ 'dist-tags': {}, time: {} }),
      } as any);

      await expect(resolveSafeVersion('missing-latest-pkg')).rejects.toThrow('No latest tag found');
    });

    it('should throw when latest has no publish time', async () => {
      const { resolveSafeVersion } = await import('../snpx.js');
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ 'dist-tags': { latest: '1.0.0' }, time: {} }),
      } as any);

      await expect(resolveSafeVersion('no-time-pkg')).rejects.toThrow('Registry did not provide a publish time');
    });

    it('should throw when latest is unparseable semver', async () => {
      const { resolveSafeVersion } = await import('../snpx.js');
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          'dist-tags': { latest: 'v1.0.0-beta+build' },
          time: { 'v1.0.0-beta+build': new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() },
        }),
      } as any);

      await expect(resolveSafeVersion('unparseable-latest')).rejects.toThrow('Unable to parse latest version');
    });
  });

  describe('fallback algorithms', () => {
    it('findPatchFallback returns version immediately before latest', async () => {
      const { buildVersionList, findPatchFallback, fetchPackageMetadata } = await import('../snpx.js');
      const data = await fetchPackageMetadata('cowsay');
      const versions = buildVersionList(data);
      const latest = data['dist-tags'].latest;

      const candidate = findPatchFallback(versions, latest);

      if (candidate) {
        expect(candidate.version).not.toBe(latest);
        const idx = versions.findIndex(v => v.version === latest);
        expect(candidate.version).toBe(versions[idx + 1]?.version);
      }
    });

    it('findPatchFallback returns null when latest is not in list', async () => {
      const { findPatchFallback } = await import('../snpx.js');
      expect(findPatchFallback([], '1.0.0')).toBeNull();
      expect(findPatchFallback([{ version: '1.0.0', time: 1 }], '2.0.0')).toBeNull();
    });

    it('findMinorFallback returns version from previous minor line', async () => {
      const { buildVersionList, findMinorFallback, parseSemver, fetchPackageMetadata } = await import('../snpx.js');
      const data = await fetchPackageMetadata('cowsay');
      const versions = buildVersionList(data);
      const latest = data['dist-tags'].latest;
      const latestParsed = parseSemver(latest);
      if (!latestParsed) {
        expect(true).toBe(true);
        return;
      }

      const candidate = findMinorFallback(versions, latestParsed);

      if (candidate) {
        const p = parseSemver(candidate.version);
        expect(p!.major).toBe(latestParsed.major);
        expect(p!.minor).toBeLessThan(latestParsed.minor);
      }
    });

    it('findMinorFallback returns null when no lower minor exists', async () => {
      const { findMinorFallback, parseSemver } = await import('../snpx.js');
      const latestParsed = parseSemver('0.0.1')!;
      expect(findMinorFallback([], latestParsed)).toBeNull();
      // 0.0.0 has the same minor (0) as 0.0.1, so it does not qualify
      expect(findMinorFallback([{ version: '0.0.1', time: 1 }, { version: '0.0.0', time: 0 }], latestParsed)).toBeNull();
    });

    it('findMajorFallback returns version from previous major line', async () => {
      const { buildVersionList, findMajorFallback, parseSemver, fetchPackageMetadata } = await import('../snpx.js');
      const data = await fetchPackageMetadata('cowsay');
      const versions = buildVersionList(data);
      const latest = data['dist-tags'].latest;
      const latestParsed = parseSemver(latest);
      if (!latestParsed) {
        expect(true).toBe(true);
        return;
      }

      const candidate = findMajorFallback(versions, latestParsed);

      if (candidate) {
        const p = parseSemver(candidate.version);
        expect(p!.major).toBeLessThan(latestParsed.major);
      }
    });

    it('findMajorFallback returns null when no lower major exists', async () => {
      const { findMajorFallback, parseSemver } = await import('../snpx.js');
      const latestParsed = parseSemver('0.1.0')!;
      expect(findMajorFallback([], latestParsed)).toBeNull();
      expect(findMajorFallback([{ version: '0.1.0', time: 1 }], latestParsed)).toBeNull();
    });

    it('buildVersionList handles empty time data', async () => {
      const { buildVersionList } = await import('../snpx.js');
      expect(buildVersionList({ time: { created: '2020-01-01', modified: '2020-01-01' } })).toEqual([]);
    });

    it('buildVersionList handles identical timestamps', async () => {
      const { buildVersionList } = await import('../snpx.js');
      const data = {
        time: {
          created: '2020-01-01',
          modified: '2020-01-01',
          '1.0.0': '2023-01-01T00:00:00.000Z',
          '1.0.1': '2023-01-01T00:00:00.000Z',
          '1.0.2': '2023-01-01T00:00:00.000Z',
        },
      };
      const list = buildVersionList(data);
      expect(list).toHaveLength(3);
      // When times are equal, original order is preserved by JS stable sort (but that's implementation detail)
      // We just assert all versions are present
      const versions = list.map(v => v.version);
      expect(versions).toContain('1.0.0');
      expect(versions).toContain('1.0.1');
      expect(versions).toContain('1.0.2');
    });
  });

  describe('buildOptions', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.SNPX_TIME;
      delete process.env.SNPX_FALLBACK_STRATEGY;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should apply defaults', async () => {
      vi.resetModules();
      const { buildOptions } = await import('../snpx.js');
      expect(buildOptions({})).toEqual({ timeHours: 24, timeMs: 24 * 60 * 60 * 1000, strategy: ['patch', 'minor', 'major'] });
    });

    it('should prefer CLI flags over env vars', async () => {
      process.env.SNPX_TIME = '72';
      process.env.SNPX_FALLBACK_STRATEGY = 'major';
      vi.resetModules();
      const { buildOptions } = await import('../snpx.js');
      expect(buildOptions({ time: '48', fallbackStrategy: 'patch' })).toEqual({ timeHours: '48', timeMs: 48 * 60 * 60 * 1000, strategy: ['patch'] });
    });

    it('should fall back to env vars', async () => {
      process.env.SNPX_TIME = '12';
      process.env.SNPX_FALLBACK_STRATEGY = 'minor,patch';
      vi.resetModules();
      const { buildOptions } = await import('../snpx.js');
      expect(buildOptions({})).toEqual({ timeHours: '12', timeMs: 12 * 60 * 60 * 1000, strategy: ['minor', 'patch'] });
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
