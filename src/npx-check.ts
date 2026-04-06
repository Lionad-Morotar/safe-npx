import { spawn } from 'child_process';
import { gte, clean } from 'semver';

const MIN_DEPRECATED_NPX = '11.10.0';
export const README_URL = 'https://github.com/Lionad-Morotar/safe-npx#readme';

/**
 * Check whether the installed npx version has made snpx obsolete.
 * Returns an error message string if npx >= 11.10.0, otherwise null.
 */
export function handleNpxVersion(version: string): string | null {
  const cleaned = clean(version);
  if (cleaned && gte(cleaned, MIN_DEPRECATED_NPX)) {
    return (
      `[snpx] Error: npx ${version} already supports min-release-age natively. snpx is no longer needed.\n` +
      `[snpx] See ${README_URL} for migration guide (use .npmrc instead).`
    );
  }
  return null;
}

/**
 * Detect npx version and exit if npm already provides min-release-age natively.
 * Set SNPX_SKIP_NPX_CHECK=1 to bypass (used by tests).
 */
export async function checkNpxVersion(): Promise<void> {
  if (process.env.SNPX_SKIP_NPX_CHECK) {
    return;
  }

  const version = await new Promise<string>((resolve) => {
    const child = spawn('npx', ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    child.on('close', (code: number | null) => {
      resolve(code === 0 ? stdout.trim() : '');
    });
    child.on('error', () => resolve(''));
  });

  const errorMsg = handleNpxVersion(version);
  if (errorMsg) {
    console.error(errorMsg);
    process.exit(1);
  }
}
