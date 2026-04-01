# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2] - 2025-04-02

### 变更
- 参数解析重构为两阶段模式：包名前仅接受 snpx 标志，包名后全部透传
- 帮助文本支持 ANSI 着色（TTY 环境自动启用，尊重 `NO_COLOR`）

## [0.2.1] - 2025-04-01

### 安全
- 未知 `--` 标志不再静默传递给 npx，改为显式报错：`Unknown flag: <arg>. Run 'snpx --help' for available options.`
- 单短横线标志（如 `-y`）正常透传给 npx

### 测试
- 新增未知标志报错测试（`--unknown-flag`、`--version`）
- 新增单短横线标志透传测试
- 测试总计 46 个

## [0.2.0] - 2025-04-01

### 变更
- **重新设计版本解析策略**：用可配置的基于发布时间的 fallback 策略替换固定 latest-1 方案（patch/minor/major）
- 缓存 TTL 改用 JSON 中嵌入的 `resolvedAt` 时间戳，不再依赖文件系统 mtime
- Fallback 算法按"最近发布的版本"语义选择
- 当注册表缺少 latest 版本的发布时间时，输出明确的错误提示

### 新增
- `--time <小时>` 标志，配置安全时间窗口（默认：24h）
- `--fallback-strategy <策略>` 标志，配置 fallback 顺序（默认：patch,minor,major）
- `--show-version` 标志，仅打印解析到的版本号，不执行
- 支持裸包名（如 `snpx cowsay`）和 scoped 包（如 `@vue/cli`）
- `SNPX_TIME` 和 `SNPX_FALLBACK_STRATEGY` 环境变量支持
- 导出函数用于测试：`parseSemver`、`buildVersionList`、`findPatchFallback`、`findMinorFallback`、`findMajorFallback`、`buildOptions`
- 测试从 22 个扩展到 44 个，覆盖边界情况和异常路径

### 修复
- 修复 scoped 裸包名（如 `@vue/cli`）的包名检测问题

## [0.1.0] - 2025-04-01

### 新增
- safe-npx (snpx) 初始发布
- 将 npx 锁定到 `latest-1` 版本，带 24 小时缓存
- 支持 `@latest` 包指定符拦截
- 自更新检查，支持 `--self-update` 和 `--unsafe-self-update` 标志
- 帮助文档，支持 `-h/--help` 标志
- 本地缓存位于 `~/.cache/snpx/`，TTL 24 小时
