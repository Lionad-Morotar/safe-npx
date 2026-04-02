import { REGISTRY } from './constants.js';
import type { VersionInfo, FetchOptions } from './types.js';

/**
 * Fetch package metadata from registry with retry logic.
 */
export async function fetchPackageMetadata(
  pkgName: string,
  options: FetchOptions = {}
): Promise<any> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelay = options.baseDelay ?? 1000;
  const maxDelay = options.maxDelay ?? 10000;
  const timeout = options.timeout ?? 10000;

  let lastError: Error | undefined;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const url = `${REGISTRY}/${encodeURIComponent(pkgName)}`;
      const res = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(timeout),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries - 1) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Build version list from registry data.
 */
export function buildVersionList(data: any): VersionInfo[] {
  return Object.entries(data.time || {})
    .filter(([v]) => v !== 'created' && v !== 'modified')
    .map(([v, t]) => ({ version: v, time: new Date(t as string).getTime() }))
    .filter((v): v is VersionInfo => !Number.isNaN(v.time))
    .sort((a, b) => b.time - a.time);
}
