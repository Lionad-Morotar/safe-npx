import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dynamic version from package.json
export let VERSION: string;
try {
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
  VERSION = pkg.version;
} catch {
  VERSION = '0.2.3'; // Fallback
}

// Paths and registry
export const CACHE_DIR = join(homedir(), '.cache', 'snpx');
export const REGISTRY = 'https://registry.npmjs.org';
export const PKG_NAME = '@lionad/safe-npx';

// Default configuration
export const DEFAULT_TIME_HOURS = 24;
export const DEFAULT_FALLBACK_STRATEGY = 'patch,minor,major';
export const MS_PER_HOUR = 60 * 60 * 1000;

// Color support detection
export const isTty = process.stdout.isTTY && !process.env.NO_COLOR;

export const colors = {
  bold: (s: string) => isTty ? `\x1b[1m${s}\x1b[22m` : s,
  dim: (s: string) => isTty ? `\x1b[2m${s}\x1b[22m` : s,
  green: (s: string) => isTty ? `\x1b[32m${s}\x1b[39m` : s,
  cyan: (s: string) => isTty ? `\x1b[36m${s}\x1b[39m` : s,
  yellow: (s: string) => isTty ? `\x1b[33m${s}\x1b[39m` : s,
};

// Help text
export const HELP_TEXT = `
${colors.bold(colors.cyan('safe-npx (snpx)'))} — Safe npx wrapper with configurable fallback strategy

${colors.bold('Usage:')}
  ${colors.green('snpx')} [options] <package>@latest [args...]
  ${colors.green('snpx')} [options] <package> [args...]
  ${colors.green('snpx')} [options] <command>

${colors.bold('Options:')}
  ${colors.yellow('-h, --help')}                Show this help message
  ${colors.yellow('--time')} ${colors.dim('<hours>')}            Safety window in hours (default: 24)
  ${colors.yellow('--fallback-strategy')} ${colors.dim('<str>')} Comma-separated fallback order.
                            Default: patch,minor,major
                            Left-to-right: first matching safe version wins.
                            ${colors.dim('patch')}  = version immediately before latest
                            ${colors.dim('minor')}  = most recently published version of previous minor line
                            ${colors.dim('major')}  = most recently published version of previous major line
  ${colors.yellow('--show-version')}            Print resolved version and exit (no execution)
  ${colors.yellow('--version')}                 Print snpx version and exit
  ${colors.yellow('--silent')}                  Suppress snpx info logs (default)
  ${colors.yellow('--verbose')}                 Show snpx info logs
  ${colors.yellow('--self-update')}             Check for snpx updates (safe mode, default 24h)
  ${colors.yellow('--unsafe-self-update')}      Allow immediate snpx updates without safety window

${colors.bold('Environment Variables:')}
  ${colors.green('SNPX_TIME')}                 Default for --time
  ${colors.green('SNPX_FALLBACK_STRATEGY')}    Default for --fallback-strategy

${colors.bold('Examples:')}
  ${colors.green('snpx')} -y cowsay@latest "Hello World"
  ${colors.green('snpx')} --time 48 --fallback-strategy patch,minor cowsay@latest
  ${colors.green('snpx')} --show-version cowsay@latest
  ${colors.green('snpx')} cowsay@latest --version               ${colors.dim('# passes --version to cowsay')}
`.trim();

// npx flags that must come BEFORE the package name (boolean flags)
export const NPX_PREFIX_FLAGS = new Set([
  '-y', '--yes',
  '--no',
  '--no-save',
  '--legacy-peer-deps',
  '--force',
  '--call', '-c',
  '--offline',
  '--prefer-offline',
  '--prefer-online',
  '--workspaces', '--ws',
  '--include-workspace-root',
  '--quiet', '-q',
]);

// npx flags that take a value and must come BEFORE the package name
export const NPX_PREFIX_FLAGS_WITH_VALUE = new Set([
  '-p', '--package',
  '-w', '--workspace',
  '--script-shell',
  '--loglevel',
  '--registry',
]);
