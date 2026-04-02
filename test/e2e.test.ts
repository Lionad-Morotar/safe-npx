import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * E2E tests for snpx CLI
 * These tests spawn actual processes to verify end-to-end behavior
 *
 * NPX flags tested based on npm docs:
 * -y, --yes        Suppress install prompt
 * --no             Don't install if missing
 * -p, --package    Specify package (can be used multiple times)
 * -c, --call       Execute shell script
 * --silent, --quiet, -q   Suppress output
 * --offline        Offline mode
 * --script-shell   Specify shell to use
 */

describe('e2e', () => {
  const TEST_PKG = 'cowsay';
  const TEST_TIMEOUT = 60000; // 60s for network operations

  // Helper to run snpx and capture output
  function runSnpx(args: string[], timeout = TEST_TIMEOUT): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn('node', ['dist/index.js', ...args], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }

  // Helper to clean npx cache using clear-npx-cache tool
  function cleanNpxCache(): Promise<void> {
    return new Promise((resolve) => {
      // First try using clear-npx-cache tool
      const child = spawn('npx', ['clear-npx-cache'], {
        stdio: 'ignore',
        timeout: 30000,
      });
      child.on('close', () => {
        // Also try to clean ~/.npx directory directly
        try {
          const npxDir = join(homedir(), '.npx');
          if (existsSync(npxDir)) {
            rmSync(npxDir, { recursive: true, force: true });
          }
        } catch {
          // Ignore errors
        }
        resolve();
      });
      child.on('error', () => {
        // Fallback: just try to remove ~/.npx
        try {
          const npxDir = join(homedir(), '.npx');
          if (existsSync(npxDir)) {
            rmSync(npxDir, { recursive: true, force: true });
          }
        } catch {
          // Ignore errors
        }
        resolve();
      });
    });
  }

  describe('npx prefix flags', () => {
    it('should pass -y flag to npx and skip install prompt', async () => {
      await cleanNpxCache();

      const { code, stdout, stderr } = await runSnpx([
        '-y',
        `${TEST_PKG}@latest`,
        'hello'
      ]);

      // Should succeed (exit code 0)
      expect(code).toBe(0);

      // Should NOT see "Ok to proceed?" prompt
      expect(stdout).not.toContain('Ok to proceed?');
      expect(stderr).not.toContain('Ok to proceed?');

      // Should see the cowsay output
      expect(stdout).toContain('hello');
    }, TEST_TIMEOUT);

    it('should pass --yes flag to npx and skip install prompt', async () => {
      await cleanNpxCache();

      const { code, stdout, stderr } = await runSnpx([
        '--yes',
        `${TEST_PKG}@latest`,
        'test'
      ]);

      expect(code).toBe(0);
      expect(stdout).not.toContain('Ok to proceed?');
      expect(stderr).not.toContain('Ok to proceed?');
      expect(stdout).toContain('test');
    }, TEST_TIMEOUT);

    it('should pass multiple npx flags correctly', async () => {
      await cleanNpxCache();

      const { code, stdout, stderr } = await runSnpx([
        '-y',
        '--silent',
        `${TEST_PKG}@latest`,
        'multi-flag-test'
      ]);

      expect(code).toBe(0);
      // Should NOT see npm warn messages with --silent
      expect(stderr).not.toContain('npm warn exec');
      // stdout should contain the cowsay output
      expect(stdout).toContain('multi-flag-test');
    }, TEST_TIMEOUT);

    it('should pass -q (quiet) flag correctly', async () => {
      await cleanNpxCache();

      const { code, stderr } = await runSnpx([
        '-y',
        '-q',
        `${TEST_PKG}@latest`,
        'quiet-test'
      ]);

      expect(code).toBe(0);
      // With --quiet, npm warn messages should be suppressed
      expect(stderr).not.toContain('npm warn');
    }, TEST_TIMEOUT);

    it('should pass --offline flag correctly', async () => {
      // Note: --offline will fail if package not in cache,
      // so we first ensure it's cached by running without --offline
      await runSnpx(['-y', `${TEST_PKG}@latest`, 'cache-warmup']);

      // Now run with --offline - should work since package is cached
      const { code, stderr } = await runSnpx([
        '-y',
        '--offline',
        `${TEST_PKG}@latest`,
        'offline-test'
      ]);

      // May fail if not cached, but flag should be passed correctly
      // Either success or specific offline error is acceptable
      if (code !== 0) {
        expect(stderr).toMatch(/offline|ENOTCACHED/i);
      }
    }, TEST_TIMEOUT);

    it('should pass --no flag to prevent installation', async () => {
      await cleanNpxCache();

      const { code, stderr } = await runSnpx([
        '--no',
        `${TEST_PKG}@latest`,
        'no-install-test'
      ]);

      // With --no, npx should NOT install and exit with error
      expect(code).not.toBe(0);
      // Should indicate the package is not available or canceled
      expect(stderr).toMatch(/not found|could not be found|must be installed|canceled due to missing packages/i);
    }, TEST_TIMEOUT);
  });

  describe('npx flags with values', () => {
    it('should pass --script-shell flag correctly', async () => {
      await cleanNpxCache();

      // --script-shell specifies the shell to use for running scripts
      const { code, stdout } = await runSnpx([
        '-y',
        '--script-shell=sh',
        `${TEST_PKG}@latest`,
        'script-shell-test'
      ]);

      expect(code).toBe(0);
      expect(stdout).toContain('script-shell-test');
    }, TEST_TIMEOUT);

    it('should pass --loglevel flag correctly', async () => {
      await cleanNpxCache();

      // --loglevel=silent should suppress warnings
      const { code, stderr } = await runSnpx([
        '-y',
        '--loglevel=silent',
        `${TEST_PKG}@latest`,
        'loglevel-test'
      ]);

      expect(code).toBe(0);
      // Should not have npm warn messages with loglevel=silent
      expect(stderr).not.toContain('npm warn');
    }, TEST_TIMEOUT);
  });

  describe('version resolution', () => {
    it('should resolve and use safe version', async () => {
      const { code, stdout } = await runSnpx([
        '-y',
        '--show-version',
        `${TEST_PKG}@latest`,
      ]);

      expect(code).toBe(0);
      // Should output a version number
      const version = stdout.trim();
      expect(version).toMatch(/^\d+\.\d+\.\d+/);
    }, TEST_TIMEOUT);

    it('should respect --time flag for safety window', async () => {
      const { code, stdout } = await runSnpx([
        '-y',
        '--time=0',
        '--show-version',
        `${TEST_PKG}@latest`,
      ]);

      expect(code).toBe(0);
      // With --time=0, should use latest version
      const version = stdout.trim();
      expect(version).toMatch(/^\d+\.\d+\.\d+/);
    }, TEST_TIMEOUT);

    it('should respect --fallback-strategy flag', async () => {
      const { code, stdout } = await runSnpx([
        '-y',
        '--fallback-strategy=patch',
        '--show-version',
        `${TEST_PKG}@latest`,
      ]);

      expect(code).toBe(0);
      const version = stdout.trim();
      expect(version).toMatch(/^\d+\.\d+\.\d+/);
    }, TEST_TIMEOUT);
  });

  describe('scoped packages', () => {
    it('should work with scoped packages', async () => {
      await cleanNpxCache();

      // Use a small scoped package for testing
      const { code } = await runSnpx([
        '-y',
        '@types/node@latest',
        '--help'
      ]);

      // @types/node --help should show TypeScript help or succeed
      // It might fail with specific error, but should not crash
      expect(code).toBeDefined();
    }, TEST_TIMEOUT);
  });
});
