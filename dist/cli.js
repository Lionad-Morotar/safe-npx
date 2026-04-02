import { DEFAULT_TIME_HOURS, DEFAULT_FALLBACK_STRATEGY, MS_PER_HOUR, HELP_TEXT, NPX_PREFIX_FLAGS, NPX_PREFIX_FLAGS_WITH_VALUE, } from './constants.js';
/**
 * Extract package name from spec.
 * @example 'cowsay@1.5.0' → 'cowsay'
 * @example '@vue/cli@latest' → '@vue/cli'
 */
export function extractPackageName(pkgSpec) {
    if (!pkgSpec)
        return null;
    // Scoped package: @scope/name@version
    if (pkgSpec.startsWith('@')) {
        const secondAt = pkgSpec.indexOf('@', 1);
        return secondAt === -1 ? pkgSpec : pkgSpec.slice(0, secondAt);
    }
    // Regular package: name@version
    const atIndex = pkgSpec.indexOf('@');
    return atIndex === -1 ? pkgSpec : pkgSpec.slice(0, atIndex);
}
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
export function parseArgs(argv) {
    const args = argv.slice(2);
    const snpxFlags = {
        help: false,
        version: false,
        showVersion: false,
        selfUpdate: false,
        unsafeSelfUpdate: false,
        time: null,
        fallbackStrategy: null,
    };
    let pkgSpec = null;
    let pkgName = null;
    const npxPrefixArgs = []; // npx flags that go BEFORE package (e.g., -y)
    const restArgs = []; // args that go AFTER package
    let foundPackage = false;
    let endOfOptions = false; // Tracks if we've seen '--'
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        // Phase 2: after package name, everything is passthrough
        if (foundPackage) {
            restArgs.push(arg);
            continue;
        }
        // End-of-options marker: stop parsing flags, next arg is package
        if (arg === '--' && !endOfOptions) {
            endOfOptions = true;
            continue;
        }
        // After '--', all arguments are positional (no flag parsing)
        if (endOfOptions) {
            pkgSpec = arg;
            pkgName = extractPackageName(arg);
            foundPackage = true;
            continue;
        }
        // Phase 1: before package, only known snpx flags accepted
        if (arg === '-h' || arg === '--help') {
            snpxFlags.help = true;
        }
        else if (arg === '--version') {
            snpxFlags.version = true;
        }
        else if (arg === '--show-version') {
            snpxFlags.showVersion = true;
        }
        else if (arg === '--self-update') {
            snpxFlags.selfUpdate = true;
        }
        else if (arg === '--unsafe-self-update') {
            snpxFlags.unsafeSelfUpdate = true;
        }
        else if (arg === '--time') {
            if (i + 1 >= args.length)
                throw new Error('Missing value for --time');
            snpxFlags.time = args[++i];
        }
        else if (arg.startsWith('--time=')) {
            snpxFlags.time = arg.slice('--time='.length);
        }
        else if (arg === '--fallback-strategy') {
            if (i + 1 >= args.length)
                throw new Error('Missing value for --fallback-strategy');
            snpxFlags.fallbackStrategy = args[++i];
        }
        else if (arg.startsWith('--fallback-strategy=')) {
            snpxFlags.fallbackStrategy = arg.slice('--fallback-strategy='.length);
        }
        else if (NPX_PREFIX_FLAGS.has(arg)) {
            // Known npx boolean flags (--offline, --silent, etc.) go before package
            npxPrefixArgs.push(arg);
        }
        else if (NPX_PREFIX_FLAGS_WITH_VALUE.has(arg)) {
            // npx flags that take a value (e.g., -p pkg, -w name)
            if (i + 1 >= args.length)
                throw new Error(`Missing value for ${arg}`);
            npxPrefixArgs.push(arg, args[++i]);
        }
        else if (arg.startsWith('--package=') || arg.startsWith('--workspace=') || arg.startsWith('--loglevel=') || arg.startsWith('--registry=') || arg.startsWith('--script-shell=')) {
            // npx --flag=value syntax
            npxPrefixArgs.push(arg);
        }
        else if (arg.startsWith('--')) {
            throw new Error(`Unknown flag: ${arg}. Run 'snpx --help' for available options.`);
        }
        else if (arg.startsWith('-')) {
            // Single-dash flags: check if it's an npx prefix flag
            if (NPX_PREFIX_FLAGS.has(arg)) {
                npxPrefixArgs.push(arg);
            }
            else if (NPX_PREFIX_FLAGS_WITH_VALUE.has(arg)) {
                if (i + 1 >= args.length)
                    throw new Error(`Missing value for ${arg}`);
                npxPrefixArgs.push(arg, args[++i]);
            }
            else {
                // Unknown single-dash flag: treat as tool arg (goes after package)
                restArgs.push(arg);
            }
        }
        else {
            // Positional argument: treat as package name
            pkgSpec = arg;
            pkgName = extractPackageName(arg);
            foundPackage = true;
        }
    }
    return {
        snpxFlags,
        pkgSpec,
        pkgName,
        npxPrefixArgs,
        restArgs,
        isLatest: !!(pkgSpec && pkgSpec.includes('@latest')),
    };
}
/**
 * Build effective execution options from CLI flags and environment variables.
 */
export function buildOptions(snpxFlags) {
    const envTime = process.env.SNPX_TIME;
    const envStrategy = process.env.SNPX_FALLBACK_STRATEGY;
    const timeHours = snpxFlags.time ?? envTime ?? DEFAULT_TIME_HOURS;
    const parsedHours = parseFloat(timeHours);
    if (!Number.isFinite(parsedHours) || parsedHours < 0) {
        console.error(`[snpx] Invalid --time value: ${timeHours}`);
        process.exit(1);
    }
    const timeMs = parsedHours * MS_PER_HOUR;
    const strategyStr = snpxFlags.fallbackStrategy ?? envStrategy ?? DEFAULT_FALLBACK_STRATEGY;
    const strategy = strategyStr.split(',').map((s) => s.trim()).filter(Boolean);
    return { timeHours, timeMs, strategy };
}
export { HELP_TEXT };
//# sourceMappingURL=cli.js.map