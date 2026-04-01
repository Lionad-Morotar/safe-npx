# safe-npx (snpx)

Safe npx wrapper with configurable time-based fallback strategy.

## Why

`npx -y pkg@latest` installs the bleeding edge. If that version was just compromised in a supply chain attack, you get owned immediately. **snpx** intercepts `@latest` (and bare package names) and resolves a safe version based on publish age and a configurable fallback strategy. This gives the security community time to catch malicious releases.

## Install

```bash
npm install -g @lionad/safe-npx
```

## Usage

Drop-in replacement for `npx`:

```bash
# Instead of npx -y create-react-app@latest my-app
snpx -y create-react-app@latest my-app

# Works with scoped packages too
snpx -y @vue/cli@latest create my-project

# Bare package names are also intercepted
snpx -y cowsay "Hello World"
```

## How it works

1. Intercepts calls containing `@latest` and bare package names
2. Queries npm registry for the package
3. If `latest` is older than the safety window (default 24h), uses `latest`
4. Otherwise, falls back through the configured strategy:
   - `patch` = version published immediately before `latest`
   - `minor` = most recently published version of the previous minor line
   - `major` = most recently published version of the previous major line
5. Verifies the fallback version is also older than the safety window
6. Caches the resolved version for the duration of the safety window
7. Executes `npx pkg@resolved_version ...`

## Options

```bash
# Configure safety window (hours)
snpx --time 48 cowsay@latest

# Configure fallback strategy (left-to-right precedence)
snpx --fallback-strategy patch,minor,major cowsay@latest

# Print resolved version without executing
snpx --show-version cowsay@latest

# Check for snpx updates (safe mode - respects 24h window)
snpx --self-update

# Bypass safety window for self-update check (not recommended)
snpx --unsafe-self-update

# Show help
snpx --help
```

## Environment Variables

- `SNPX_TIME` — Default for `--time`
- `SNPX_FALLBACK_STRATEGY` — Default for `--fallback-strategy`

## Cache

Resolved versions are cached in `~/.cache/snpx/` for the duration of the safety window (default 24 hours). This means:
- Fast subsequent runs (no registry requests)
- At most one registry query per package per window

## Acknowledgments

Inspired by [safe-npm](https://github.com/kevinslin/safe-npm) by Kevin Lin. The core idea of using package age as a supply chain security signal comes from that project.

## License

MIT
