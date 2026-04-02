<center>
   <img src="./assets/logo.png" alt="safe-npx logo" height="300px"/>
   <p style="margin-top: -4em;"><em><code>snpx -y pkg@latest</code> protects you from newly compromised packages</em></p>
   <br>
   <br>
</center>

## Why / 为什么需要

`npx -y pkg@latest` installs the bleeding edge. If that version was just compromised in a supply chain attack, you get owned immediately. **snpx** intercepts `@latest`, bare package names, and version ranges — resolving a safe version based on publish age and a configurable fallback strategy. This gives the security community time to catch malicious releases.

`npx -y pkg@latest` 会直接安装最新版本。如果该版本刚被供应链攻击（Supply Chain Attack）篡改，你会立即中招。**snpx** 会拦截 `@latest`、裸包名以及版本范围，根据发布时间和可配置的回退策略（Fallback Strategy）解析出一个安全版本。这为安全社区争取了发现和处置恶意发布的时间窗口。

## Install / 安装

```bash
npm install -g @lionad/safe-npx
```

## Usage / 用法

Drop-in replacement for `npx` — 直接替换 `npx` 即可：

```bash
# Instead of npx -y create-react-app@latest my-app
# 替代 npx -y create-react-app@latest my-app
snpx -y create-react-app@latest my-app

# Works with scoped packages too / 支持带 scope 的包
snpx -y @vue/cli@latest create my-project

# Bare package names are also intercepted / 裸包名同样会被拦截
snpx -y cowsay "Hello World"

# Flags after the package are passed through to the tool / 包名之后的参数会透传给被执行的工具
snpx cowsay@latest --version

# Use -- to prevent tool flags from being parsed as snpx flags / 使用 -- 防止工具参数被误解析为 snpx 标志
snpx -- cowsay --help
snpx --time 48 -- cowsay --version
```

### Argument Parsing / 参数解析规则

snpx 使用**包名前/后**来区分不同层级的参数：

**Before package / 包名之前**（会被 snpx 识别和处理）：

| 类别 | 支持的参数 | 说明 |
|------|-----------|------|
| **snpx 专属** | `--help`, `--version`, `--show-version`<br>`--time`, `--fallback-strategy`<br>`--self-update`, `--unsafe-self-update` | snpx 的配置选项 |
| **npx 白名单** | `-y`, `--yes`, `--no`<br>`-p <pkg>`, `--package=<pkg>`<br>`-c <cmd>`, `--call=<cmd>`<br>`--offline`, `--prefer-offline`<br>`-w <name>`, `--workspace=<name>`<br>`--silent`, `--quiet`, `--registry=<url>` | 传递给 npx 的前置参数 |

**After package / 包名之后**（全部透传给被执行的工具）：

```bash
snpx cowsay@latest --version --json   # --version 和 --json 都传给 cowsay
```

**特殊分隔符 `--`**：强制其后的第一个参数被识别为包名，其余全部透传：

```bash
# -- 后的第一个参数是包名，其余给工具
snpx --time 48 -- cowsay --help       # --help 传给 cowsay，不是 snpx

# 如果需要将白名单参数强制作为工具参数，用 -- 转义
snpx -- cowsay -y "hello"             # -y 传给 cowsay，不是 npx
```

## How it works / 工作原理

### Version Resolution Strategy / 版本解析策略

snpx decides whether to intercept based on how you specify the version:

| Spec / 指定方式 | Example / 例子 | Behavior / 行为 |
|----------------|----------------|-----------------|
| Exact version / 精确版本 | `cowsay@1.5.0` | **Pass through** — snpx does not interfere, your exact version is used |
| latest | `cowsay@latest` | **Intercept** — resolves to a safe version |
| Bare name / 裸包名 | `cowsay` | **Intercept** — resolves to a safe version |
| Range / 范围 | `cowsay@^1.0.0`, `>=1.5` | **Intercept** — resolves to a safe version within range |

### Resolution Flow / 解析流程

1. Intercepts calls with `@latest`, bare package names, and version ranges / 拦截 `@latest`、裸包名和版本范围的调用
2. Queries npm registry for the package / 查询 npm registry 获取包信息
3. If `latest` is older than the safety window (default 24h), uses `latest` / 如果 `latest` 发布时间超过安全窗口（默认 24 小时），直接使用
4. Otherwise, falls back through the configured strategy / 否则，按配置的策略依次回退：
   - `patch` = version published immediately before `latest` / 发布时间紧邻 `latest` 之前的版本
   - `minor` = most recently published version of the previous minor line / 上一个 minor 线最近发布的版本
   - `major` = most recently published version of the previous major line / 上一个 major 线最近发布的版本
5. Verifies the fallback version is also older than the safety window / 验证回退版本的发布时间也超过安全窗口
6. Caches the resolved version for the duration of the safety window / 在安全窗口期间缓存解析结果
7. Executes `npx pkg@resolved_version ...` / 执行 `npx pkg@resolved_version ...`

## Options / 选项

```bash
# Configure safety window (hours) / 配置安全窗口（小时）
snpx --time 48 cowsay@latest

# Configure fallback strategy (left-to-right precedence) / 配置回退策略（从左到右优先）
snpx --fallback-strategy patch,minor,major cowsay@latest

# Print resolved version without executing / 打印解析到的版本但不执行
snpx --show-version cowsay@latest

# Print snpx version / 打印 snpx 版本
snpx --version

# Check for snpx updates (safe mode - respects 24h window) / 检查 snpx 自身更新（安全模式，遵守 24 小时窗口）
snpx --self-update

# Bypass safety window for self-update check (not recommended) / 跳过安全窗口检查更新（不推荐）
snpx --unsafe-self-update

# Show help / 显示帮助
snpx --help

# Use -- to prevent tool flags from being parsed as snpx flags / 使用 -- 防止工具参数被误解析为 snpx 标志
snpx -- cowsay --help
```

## Environment Variables / 环境变量

- `SNPX_TIME` — Default for `--time` / `--time` 的默认值
- `SNPX_FALLBACK_STRATEGY` — Default for `--fallback-strategy` (e.g. `patch,minor,major`) / `--fallback-strategy` 的默认值（如 `patch,minor,major`）

## Reliability Features / 可靠性特性

### Cache / 缓存

Resolved versions are cached in `~/.cache/snpx/` for the duration of the safety window (default 24 hours). This means:
- Fast subsequent runs (no registry requests) / 后续运行更快（无需请求 registry）
- At most one registry query per package per window / 每个安全窗口内每个包最多一次 registry 查询
- Atomic writes prevent cache corruption during concurrent runs / 原子写入防止并发运行时的缓存损坏

### Network Resilience / 网络容错

- Automatic retry with exponential backoff (up to 3 attempts) / 指数退避自动重试（最多 3 次）
- 10-second timeout per request / 每个请求 10 秒超时
- Graceful handling of registry outages / 优雅处理 registry 故障

### TypeScript Support / TypeScript 支持

Type definitions are included. Import types for IDE autocompletion:

```typescript
import type { ParsedArgs, Semver } from '@lionad/safe-npx';
```

## Acknowledgments / 致谢

Inspired by [safe-npm](https://github.com/kevinslin/safe-npm) by Kevin Lin.

灵感来自 Kevin Lin 的 [safe-npm](https://github.com/kevinslin/safe-npm)。

## License

MIT
