import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseArgs, buildOptions, extractPackageName, createLogger } from '../src/cli.js';

describe('cli', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.SNPX_TIME;
    delete process.env.SNPX_FALLBACK_STRATEGY;
  });

  describe('extractPackageName', () => {
    it('should extract name from simple packages', () => {
      expect(extractPackageName('cowsay')).toBe('cowsay');
      expect(extractPackageName('cowsay@1.5.0')).toBe('cowsay');
      expect(extractPackageName('cowsay@latest')).toBe('cowsay');
    });

    it('should extract name from scoped packages', () => {
      expect(extractPackageName('@vue/cli')).toBe('@vue/cli');
      expect(extractPackageName('@vue/cli@4.5.0')).toBe('@vue/cli');
      expect(extractPackageName('@vue/cli@latest')).toBe('@vue/cli');
    });

    it('should handle falsy values', () => {
      expect(extractPackageName('')).toBeNull();
      expect(extractPackageName(null as any)).toBeNull();
      expect(extractPackageName(undefined as any)).toBeNull();
    });
  });

  describe('parseArgs', () => {
    it('should parse package@latest pattern', () => {
      const result = parseArgs(['node', 'snpx', 'cowsay@latest', 'hello']);

      expect(result.pkgSpec).toBe('cowsay@latest');
      expect(result.pkgName).toBe('cowsay');
      expect(result.restArgs).toEqual(['hello']);
      expect(result.isLatest).toBe(true);
      expect(result.snpxFlags.help).toBe(false);
    });

    it('should parse scoped package@latest pattern', () => {
      const result = parseArgs(['node', 'snpx', '@vue/cli@latest', 'create', 'my-app']);

      expect(result.pkgSpec).toBe('@vue/cli@latest');
      expect(result.pkgName).toBe('@vue/cli');
      expect(result.restArgs).toEqual(['create', 'my-app']);
      expect(result.isLatest).toBe(true);
    });

    it('should parse exact version packages but mark as non-latest', () => {
      const result = parseArgs(['node', 'snpx', 'cowsay@1.0.0', 'hello']);

      expect(result.pkgSpec).toBe('cowsay@1.0.0');
      expect(result.pkgName).toBe('cowsay');
      expect(result.restArgs).toEqual(['hello']);
      expect(result.isLatest).toBe(false);
    });

    it('should handle flags before package', () => {
      const result = parseArgs(['node', 'snpx', '-y', 'cowsay@latest', 'hello']);

      expect(result.pkgSpec).toBe('cowsay@latest');
      expect(result.pkgName).toBe('cowsay');
      expect(result.npxPrefixArgs).toEqual(['-y']);
      expect(result.restArgs).toEqual(['hello']);
    });

    it('should parse bare package name', () => {
      const result = parseArgs(['node', 'snpx', '-y', 'cowsay', 'hello']);

      expect(result.pkgSpec).toBe('cowsay');
      expect(result.pkgName).toBe('cowsay');
      expect(result.npxPrefixArgs).toEqual(['-y']);
      expect(result.restArgs).toEqual(['hello']);
      expect(result.isLatest).toBe(false);
    });

    it('should parse --time flag', () => {
      const result = parseArgs(['node', 'snpx', '--time', '48', 'cowsay@latest']);

      expect(result.snpxFlags.time).toBe('48');
      expect(result.pkgName).toBe('cowsay');
      expect(result.restArgs).toEqual([]);
    });

    it('should parse --fallback-strategy flag', () => {
      const result = parseArgs(['node', 'snpx', '--fallback-strategy', 'patch,minor', 'cowsay']);

      expect(result.snpxFlags.fallbackStrategy).toBe('patch,minor');
      expect(result.pkgName).toBe('cowsay');
    });

    it('should parse --show-version flag', () => {
      const result = parseArgs(['node', 'snpx', '--show-version', 'cowsay@latest']);

      expect(result.snpxFlags.showVersion).toBe(true);
      expect(result.pkgName).toBe('cowsay');
    });

    it('should default silent to true', () => {
      const result = parseArgs(['node', 'snpx', 'cowsay@latest']);
      expect(result.snpxFlags.silent).toBe(true);
      expect(result.snpxFlags.verbose).toBe(false);
    });

    it('should keep silent true with --silent flag', () => {
      const result = parseArgs(['node', 'snpx', '--silent', 'cowsay@latest']);
      expect(result.snpxFlags.silent).toBe(true);
      expect(result.snpxFlags.verbose).toBe(false);
    });

    it('should set silent false with --verbose flag', () => {
      const result = parseArgs(['node', 'snpx', '--verbose', 'cowsay@latest']);
      expect(result.snpxFlags.silent).toBe(false);
      expect(result.snpxFlags.verbose).toBe(true);
    });

    it('should not pass --silent to npxPrefixArgs', () => {
      const result = parseArgs(['node', 'snpx', '-y', '--silent', 'cowsay@latest']);
      expect(result.npxPrefixArgs).toEqual(['-y']);
      expect(result.snpxFlags.silent).toBe(true);
    });

    it('should ignore snpx flags in restArgs', () => {
      const result = parseArgs(['node', 'snpx', '--time', '48', '--fallback-strategy', 'patch,minor', '-y', 'cowsay@latest', 'hello']);

      expect(result.npxPrefixArgs).toEqual(['-y']);
      expect(result.restArgs).toEqual(['hello']);
      expect(result.snpxFlags.time).toBe('48');
      expect(result.snpxFlags.fallbackStrategy).toBe('patch,minor');
    });

    it('should support --time=48 syntax', () => {
      const result = parseArgs(['node', 'snpx', '--time=48', 'cowsay@latest']);

      expect(result.snpxFlags.time).toBe('48');
      expect(result.pkgName).toBe('cowsay');
    });

    it('should support --fallback-strategy=patch,minor syntax', () => {
      const result = parseArgs(['node', 'snpx', '--fallback-strategy=patch,minor', 'cowsay@latest']);

      expect(result.snpxFlags.fallbackStrategy).toBe('patch,minor');
      expect(result.pkgName).toBe('cowsay');
    });

    it('should throw when --time is the last argument', () => {
      expect(() => parseArgs(['node', 'snpx', '--time'])).toThrow('Missing value for --time');
    });

    it('should throw when --fallback-strategy is the last argument', () => {
      expect(() => parseArgs(['node', 'snpx', '--fallback-strategy'])).toThrow('Missing value for --fallback-strategy');
    });

    it('should parse scoped bare package name', () => {
      const result = parseArgs(['node', 'snpx', '-y', '@vue/cli', 'create', 'my-app']);

      expect(result.pkgSpec).toBe('@vue/cli');
      expect(result.pkgName).toBe('@vue/cli');
      expect(result.npxPrefixArgs).toEqual(['-y']);
      expect(result.restArgs).toEqual(['create', 'my-app']);
    });

    it('should throw on unknown --flags', () => {
      expect(() => parseArgs(['node', 'snpx', '--unknown-flag', 'cowsay@latest'])).toThrow('Unknown flag: --unknown-flag');
    });

    it('should parse --version flag', () => {
      const result1 = parseArgs(['node', 'snpx', '--version']);
      expect(result1.snpxFlags.version).toBe(true);
      expect(result1.pkgName).toBeNull();

      const result2 = parseArgs(['node', 'snpx', '--version', 'cowsay@latest']);
      expect(result2.snpxFlags.version).toBe(true);
      expect(result2.pkgName).toBe('cowsay');
    });

    it('should pass --version through when after package name (two-phase)', () => {
      const result = parseArgs(['node', 'snpx', 'cowsay@latest', '--version']);
      expect(result.pkgName).toBe('cowsay');
      expect(result.restArgs).toContain('--version');
    });

    it('should pass any --flags through when after package name', () => {
      const result = parseArgs(['node', 'snpx', 'cowsay@latest', '--version', '--json', '-l']);
      expect(result.pkgName).toBe('cowsay');
      expect(result.restArgs).toEqual(['--version', '--json', '-l']);
    });

    it('should pass single-dash npx flags to npxPrefixArgs', () => {
      const result = parseArgs(['node', 'snpx', '-y', 'cowsay@latest']);
      expect(result.npxPrefixArgs).toEqual(['-y']);
      expect(result.restArgs).toEqual([]);
      expect(result.pkgName).toBe('cowsay');
    });

    it('should handle -- separator correctly', () => {
      const result = parseArgs(['node', 'snpx', '-y', '--', 'cowsay', 'hello']);
      expect(result.pkgName).toBe('cowsay');
      expect(result.npxPrefixArgs).toEqual(['-y']);
      expect(result.restArgs).toEqual(['hello']);
    });

    it('should treat everything after -- as passthrough', () => {
      const result = parseArgs(['node', 'snpx', '--', '--help', '--version']);
      expect(result.pkgName).toBe('--help');
      expect(result.restArgs).toEqual(['--version']);
    });
  });

  describe('buildOptions', () => {
    it('should apply defaults', () => {
      expect(buildOptions({})).toEqual({ timeHours: 24, timeMs: 24 * 60 * 60 * 1000, strategy: ['patch', 'minor', 'major'], silent: true });
    });

    it('should prefer CLI flags over env vars', () => {
      process.env.SNPX_TIME = '72';
      process.env.SNPX_FALLBACK_STRATEGY = 'major';
      expect(buildOptions({ time: '48', fallbackStrategy: 'patch' })).toEqual({ timeHours: '48', timeMs: 48 * 60 * 60 * 1000, strategy: ['patch'], silent: true });
    });

    it('should fall back to env vars', () => {
      process.env.SNPX_TIME = '12';
      process.env.SNPX_FALLBACK_STRATEGY = 'minor,patch';
      expect(buildOptions({})).toEqual({ timeHours: '12', timeMs: 12 * 60 * 60 * 1000, strategy: ['minor', 'patch'], silent: true });
    });

    it('should respect --verbose flag', () => {
      expect(buildOptions({ verbose: true })).toEqual({ timeHours: 24, timeMs: 24 * 60 * 60 * 1000, strategy: ['patch', 'minor', 'major'], silent: false });
    });

    it('should respect explicit --silent flag', () => {
      expect(buildOptions({ silent: true })).toEqual({ timeHours: 24, timeMs: 24 * 60 * 60 * 1000, strategy: ['patch', 'minor', 'major'], silent: true });
    });
  });

  describe('createLogger', () => {
    it('should write info messages to stderr when not silent', () => {
      const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = createLogger(false);
      logger.info('[snpx] hello');
      expect(stderrSpy).toHaveBeenCalledWith('[snpx] hello');
      stderrSpy.mockRestore();
    });

    it('should suppress info messages when silent', () => {
      const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = createLogger(true);
      logger.info('[snpx] hidden');
      expect(stderrSpy).not.toHaveBeenCalled();
      stderrSpy.mockRestore();
    });
  });
});
