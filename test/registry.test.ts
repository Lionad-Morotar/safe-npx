import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchPackageMetadata, buildVersionList } from '../src/registry.js';

describe('registry', () => {
  let originalFetch = global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should fetch package metadata from registry', async () => {
    const data = await fetchPackageMetadata('cowsay');

    expect(data).toHaveProperty('name', 'cowsay');
    expect(data).toHaveProperty('dist-tags');
    expect(data).toHaveProperty('time');
    expect(data['dist-tags']).toHaveProperty('latest');
  });

  it('should retry on failure', async () => {
    let attempts = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ name: 'test-pkg', 'dist-tags': { latest: '1.0.0' } }),
      } as Response);
    });

    const data = await fetchPackageMetadata('test-pkg', { maxRetries: 3, baseDelay: 10 });
    expect(data).toHaveProperty('name', 'test-pkg');
    expect(attempts).toBe(3);
  });

  it('should throw after max retries', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(fetchPackageMetadata('test-pkg', { maxRetries: 2, baseDelay: 10 }))
      .rejects.toThrow('Failed after 2 attempts');
  });

  it('should throw on HTTP error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    await expect(fetchPackageMetadata('non-existent-pkg', { maxRetries: 1 }))
      .rejects.toThrow('Failed after 1 attempts');
  });

  describe('buildVersionList', () => {
    it('should build version list from registry data', () => {
      const data = {
        time: {
          created: '2020-01-01',
          modified: '2023-01-01',
          '1.0.0': '2023-01-01T00:00:00.000Z',
          '1.0.1': '2023-02-01T00:00:00.000Z',
          '1.1.0': '2023-03-01T00:00:00.000Z',
        },
      };

      const list = buildVersionList(data);
      expect(list).toHaveLength(3);
      expect(list[0].version).toBe('1.1.0'); // sorted by time descending
      expect(list[1].version).toBe('1.0.1');
      expect(list[2].version).toBe('1.0.0');
    });

    it('should handle empty time data', () => {
      expect(buildVersionList({ time: { created: '2020-01-01', modified: '2020-01-01' } })).toEqual([]);
    });

    it('should filter out invalid timestamps', () => {
      const data = {
        time: {
          created: '2020-01-01',
          '1.0.0': 'invalid-date',
          '1.0.1': '2023-01-01T00:00:00.000Z',
        },
      };

      const list = buildVersionList(data);
      expect(list).toHaveLength(1);
      expect(list[0].version).toBe('1.0.1');
    });
  });
});
