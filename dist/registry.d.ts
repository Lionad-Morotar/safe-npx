import type { VersionInfo, FetchOptions } from './types.js';
/**
 * Fetch package metadata from registry with retry logic.
 */
export declare function fetchPackageMetadata(pkgName: string, options?: FetchOptions): Promise<any>;
/**
 * Build version list from registry data.
 */
export declare function buildVersionList(data: any): VersionInfo[];
