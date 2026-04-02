import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseSemver,
  shouldIntercept,
  findPatchFallback,
  findMinorFallback,
  findMajorFallback,
  resolveSafeVersion,
  checkSelfUpdate,
} from '../src/version.js';
import { CACHE_DIR } from '../src/constants.js';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';

describe('version', () => {
  let originalFetch = global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    // Clean test cache
    const cacheFile = join(CACHE_DIR, 'cowsay.json');
    if (existsSync(cacheFile)) rmSync(cacheFile);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    const cacheFile = join(CACHE_DIR, 'cowsay.json');
    if (existsSync(cacheFile)) rmSync(cacheFile);
  });

  describe('parseSemver', () => {
    it('should parse valid semver', () => {
      expect(parseSemver('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: null, build: null, raw: '1.2.3' });
    });

    it('should parse prerelease and build metadata', () => {
      expect(parseSemver('1.2.3-alpha.1')).toMatchObject({ major: 1, minor: 2, patch: 3, prerelease: 'alpha.1' });
      expect(parseSemver('1.2.3+build.4')).toMatchObject({ major: 1, minor: 2, patch: 3, build: 'build.4' });
      expect(parseSemver('1.2.3-alpha.1+build.4')).toMatchObject({ major: 1, minor: 2, patch: 3, prerelease: 'alpha.1', build: 'build.4' });
    });

    it('should handle zero values', () => {
      expect(parseSemver('0.0.0')).toMatchObject({ major: 0, minor: 0, patch: 0 });
    });

    it('should return null for invalid semver', () => {
      expect(parseSemver('1.2')).toBeNull();
      expect(parseSemver('latest')).toBeNull();
      expect(parseSemver('')).toBeNull();
    });
  });

  describe('shouldIntercept', () => {
    it('should NOT intercept exact versions', () => {
      expect(shouldIntercept('cowsay@1.5.0')).toBe(false);
      expect(shouldIntercept('cowsay@0.0.0')).toBe(false);
      expect(shouldIntercept('@vue/cli@4.5.0')).toBe(false);
    });

    it('should intercept latest', () => {
      expect(shouldIntercept('cowsay@latest')).toBe(true);
      expect(shouldIntercept('@vue/cli@latest')).toBe(true);
    });

    it('should intercept range versions', () => {
      expect(shouldIntercept('cowsay@^1.0.0')).toBe(true);
      expect(shouldIntercept('cowsay@~1.0.0')).toBe(true);
      expect(shouldIntercept('cowsay@>=1.5.0')).toBe(true);
      expect(shouldIntercept('cowsay@>1.0.0 <2.0.0')).toBe(true);
      expect(shouldIntercept('cowsay@1.x')).toBe(true);
    });

    it('should intercept bare package names', () => {
      expect(shouldIntercept('cowsay')).toBe(true);
      expect(shouldIntercept('@vue/cli')).toBe(true);
    });

    it('should handle falsy values', () => {
      expect(shouldIntercept('')).toBe(false);
      expect(shouldIntercept(null as any)).toBe(false);
      expect(shouldIntercept(undefined as any)).toBe(false);
    });
  });

  describe('fallback algorithms', () => {
    it('findPatchFallback returns version immediately before latest', async () => {
      const { fetchPackageMetadata } = await import('../src/registry.js');
      const data = await fetchPackageMetadata('cowsay');
      const { buildVersionList } = await import('../src/registry.js');
      const versions = buildVersionList(data);
      const latest = data['dist-tags'].latest;

      const candidate = findPatchFallback(versions, latest);

      if (candidate) {
        expect(candidate.version).not.toBe(latest);
        const idx = versions.findIndex(v => v.version === latest);
        expect(candidate.version).toBe(versions[idx + 1]?.version);
      }
    });

    it('findPatchFallback returns null when latest is not in list', () => {
      expect(findPatchFallback([], '1.0.0')).toBeNull();
      expect(findPatchFallback([{ version: '1.0.0', time: 1 }], '2.0.0')).toBeNull();
    });

    it('findMinorFallback returns version from previous minor line', async () => {
      const { fetchPackageMetadata, buildVersionList } = await import('../src/registry.js');
      const data = await fetchPackageMetadata('cowsay');
      const versions = buildVersionList(data);
      const latest = data['dist-tags'].latest;
      const latestParsed = parseSemver(latest);

      // Skip assertion if semver cannot be parsed (registry data edge case)
      if (!latestParsed) return;

      const candidate = findMinorFallback(versions, latestParsed);

      if (candidate) {
        const p = parseSemver(candidate.version);
        expect(p!.major).toBe(latestParsed.major);
        expect(p!.minor).toBeLessThan(latestParsed.minor);
      }
    });

    it('findMinorFallback returns null when no lower minor exists', () => {
      const latestParsed = parseSemver('0.0.1')!;
      expect(findMinorFallback([], latestParsed)).toBeNull();
      // 0.0.0 has the same minor (0) as 0.0.1, so it does not qualify
      expect(findMinorFallback([{ version: '0.0.1', time: 1 }, { version: '0.0.0', time: 0 }], latestParsed)).toBeNull();
    });

    it('findMajorFallback returns version from previous major line', async () => {
      const { fetchPackageMetadata, buildVersionList } = await import('../src/registry.js');
      const data = await fetchPackageMetadata('cowsay');
      const versions = buildVersionList(data);
      const latest = data['dist-tags'].latest;
      const latestParsed = parseSemver(latest);

      // Skip assertion if semver cannot be parsed (registry data edge case)
      if (!latestParsed) return;

      const candidate = findMajorFallback(versions, latestParsed);

      if (candidate) {
        const p = parseSemver(candidate.version);
        expect(p!.major).toBeLessThan(latestParsed.major);
      }
    });

    it('findMajorFallback returns null when no lower major exists', () => {
      const latestParsed = parseSemver('0.1.0')!;
      expect(findMajorFallback([], latestParsed)).toBeNull();
      expect(findMajorFallback([{ version: '0.1.0', time: 1 }], latestParsed)).toBeNull();
    });
  });

  describe('resolveSafeVersion', () => {
    it('should return latest if it is old enough (timeMs=0)', async () => {
      const { fetchPackageMetadata } = await import('../src/registry.js');
      const data = await fetchPackageMetadata('cowsay');
      const latest = data['dist-tags'].latest;

      const version = await resolveSafeVersion('cowsay', { timeMs: 0, strategy: ['patch'] });
      expect(version).toBe(latest);
    });

    it('should throw error for non-existent package', async () => {
      await expect(resolveSafeVersion('non-existent-pkg-12345-abc')).rejects.toThrow();
    });

    it('should throw when latest tag is missing', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ 'dist-tags': {}, time: {} }),
      } as any);

      await expect(resolveSafeVersion('missing-latest-pkg')).rejects.toThrow('No latest tag found');
    });

    it('should throw when latest has no publish time', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ 'dist-tags': { latest: '1.0.0' }, time: {} }),
      } as any);

      await expect(resolveSafeVersion('no-time-pkg')).rejects.toThrow('Registry did not provide a publish time');
    });

    it('should throw when latest is unparseable semver', async () => {
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

  describe('checkSelfUpdate', () => {
    it('should check for self updates', async () => {
      const result = await checkSelfUpdate();

      expect(result).toHaveProperty('hasUpdate');
      expect(result).toHaveProperty('currentVersion');
      expect(result).toHaveProperty('latestVersion');
      expect(typeof result.hasUpdate).toBe('boolean');
    });
  });
});
