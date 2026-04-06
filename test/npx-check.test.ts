import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleNpxVersion, checkNpxVersion, README_URL } from '../src/npx-check.js';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

describe('handleNpxVersion', () => {
  it('returns null for versions below 11.10.0', () => {
    expect(handleNpxVersion('11.9.0')).toBeNull();
    expect(handleNpxVersion('10.0.0')).toBeNull();
    expect(handleNpxVersion('9.8.7')).toBeNull();
  });

  it('returns error message for 11.10.0', () => {
    const msg = handleNpxVersion('11.10.0');
    expect(msg).toContain('Error: npx 11.10.0 already supports min-release-age natively');
    expect(msg).toContain(README_URL);
    expect(msg).toContain('.npmrc');
  });

  it('returns error message for newer versions', () => {
    const msg = handleNpxVersion('11.12.1');
    expect(msg).toContain('Error: npx 11.12.1 already supports min-release-age natively');
    expect(msg).toContain(README_URL);
  });

  it('returns null for invalid versions', () => {
    expect(handleNpxVersion('')).toBeNull();
    expect(handleNpxVersion('not-a-version')).toBeNull();
    expect(handleNpxVersion('v11.x')).toBeNull();
  });

  it('returns null for prerelease versions below 11.10.0', () => {
    expect(handleNpxVersion('11.10.0-rc.1')).toBeNull();
  });
});

describe('checkNpxVersion', () => {
  const originalExit = process.exit;
  const originalError = console.error;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.mocked(spawn).mockClear();
    process.exit = vi.fn((() => {
      throw new Error('PROCESS_EXIT');
    }) as any);
    console.error = vi.fn();
    process.env = { ...originalEnv };
    delete process.env.SNPX_SKIP_NPX_CHECK;
  });

  afterEach(() => {
    process.exit = originalExit;
    console.error = originalError;
    process.env = originalEnv;
  });

  function mockSpawn(stdoutValue: string, code: number | null = 0) {
    vi.mocked(spawn).mockImplementation(() => {
      const stdout = new EventEmitter() as any;
      const child = new EventEmitter() as any;
      child.stdout = stdout;
      process.nextTick(() => {
        stdout.emit('data', Buffer.from(stdoutValue));
        child.emit('close', code);
      });
      return child;
    });
  }

  it('resolves without error for older npx versions', async () => {
    mockSpawn('10.5.0\n');
    await expect(checkNpxVersion()).resolves.toBeUndefined();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('exits with error for npx >= 11.10.0', async () => {
    mockSpawn('11.10.0\n');
    await expect(checkNpxVersion()).rejects.toThrow('PROCESS_EXIT');
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Error: npx 11.10.0 already supports min-release-age natively')
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('exits with error for npx 11.12.1', async () => {
    mockSpawn('11.12.1\n');
    await expect(checkNpxVersion()).rejects.toThrow('PROCESS_EXIT');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('resolves silently when spawn fails', async () => {
    mockSpawn('', 1);
    await expect(checkNpxVersion()).resolves.toBeUndefined();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('resolves silently when spawn errors', async () => {
    vi.mocked(spawn).mockImplementation(() => {
      const stdout = new EventEmitter() as any;
      const child = new EventEmitter() as any;
      child.stdout = stdout;
      process.nextTick(() => {
        child.emit('error', new Error('spawn error'));
      });
      return child;
    });
    await expect(checkNpxVersion()).resolves.toBeUndefined();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('bypasses check when SNPX_SKIP_NPX_CHECK is set', async () => {
    process.env.SNPX_SKIP_NPX_CHECK = '1';
    await expect(checkNpxVersion()).resolves.toBeUndefined();
    expect(spawn).not.toHaveBeenCalled();
  });
});
