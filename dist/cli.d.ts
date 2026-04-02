import { HELP_TEXT } from './constants.js';
import type { ParsedArgs, SnpxFlags, CliOptions } from './types.js';
/**
 * Extract package name from spec.
 * @example 'cowsay@1.5.0' → 'cowsay'
 * @example '@vue/cli@latest' → '@vue/cli'
 */
export declare function extractPackageName(pkgSpec: string | null | undefined): string | null;
/**
 * Parse CLI arguments using two-phase parsing:
 *
 *   Phase 1 (before package): Only snpx flags accepted.
 *     Unknown --flags → error. Single-dash flags (-y) → npx passthrough.
 *   Phase 2 (after package): Everything is passthrough to the executed tool.
 *
 *   snpx [snpx-flags] [--] <package> [tool-args...]
 *   snpx [snpx-flags]                (--help, --self-update, etc.)
 */
export declare function parseArgs(argv: string[]): ParsedArgs;
/**
 * Build effective execution options from CLI flags and environment variables.
 */
export declare function buildOptions(snpxFlags: Partial<SnpxFlags>): CliOptions;
export { HELP_TEXT };
