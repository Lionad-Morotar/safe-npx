# safe-npx (snpx)

Safe npx wrapper - lock to latest-1 version with 24h cache.

## Why

`npx -y pkg@latest` installs the bleeding edge. If that version was just compromised in a supply chain attack, you get owned immediately. **snpx** installs the version *before* latest, and only if it's at least 24 hours old. This gives the security community time to catch malicious releases.

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
```

### Self-update check

```bash
# Check for snpx updates (safe mode - respects 24h window)
snpx --self-update

# Bypass safety window (not recommended)
snpx --unsafe-self-update

# Show help
snpx --help
```

## How it works

1. Intercepts calls containing `@latest`
2. Queries npm registry for the package
3. Finds the version published immediately before `latest`
4. Verifies that version is at least 24 hours old
5. Caches the resolved version for 24 hours
6. Executes `npx pkg@resolved_version ...`

Calls without `@latest` are passed through directly to npx.

## Cache

Resolved versions are cached in `~/.cache/snpx/` for 24 hours. This means:
- Fast subsequent runs (no registry requests)
- At most one registry query per package per day

## Acknowledgments

Inspired by [safe-npm](https://github.com/kevinslin/safe-npm) by Kevin Lin. The core idea of using package age as a supply chain security signal comes from that project.

## License

MIT
