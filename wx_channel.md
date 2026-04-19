# WeChat Channel 接入计划

## 目标

将 `E:\claude-code\cc-weixin` 迁入本仓库，作为 **built-in plugin + built-in stdio MCP channel server** 接入，支持：

- 微信消息推送到 Claude Code 会话
- Claude Code 通过 MCP 工具回复微信消息
- 使用 `--channels plugin:weixin@builtin` 在会话级启用

MVP 初版曾暂不包含远程工具审批（permission relay），但当前实现已将该能力补齐。

## 进度更新

### 2026-04-19（最新）

当前落地状态：

- built-in weixin plugin 已完成接入
- `ccb weixin serve|login|access pair` CLI 链路已完成
- weixin MCP stdio server、消息轮询、`reply` / `send_typing` 已完成
- `--channels plugin:weixin@builtin` 启用链路已完成
- ChannelsNotice 对 builtin plugin 的误报修复已完成
- permission relay 已完成并通过闭环验证：
  - server 声明 `experimental["claude/channel/permission"]`
  - 接收 `notifications/claude/channel/permission_request`
  - 通过微信发送审批提示
  - 解析 `yes/no <request_id>`
  - 回发 `notifications/claude/channel/permission`
- permission relay 的关键路由与 capability 判定问题已修复并验证通过：
  - 不再把权限请求盲发给“最后活跃聊天”，而是携带当前会话最近 channel 消息的 `chat_id/source_server` 作为路由提示
  - `claude/channel/permission` 的 capability 判定已统一为 truthy 语义

当前验证状态：

- `bun run typecheck` 已通过
- `bun run build` 已通过
- weixin 相关定向测试已通过
- 手工 E2E 已通过
- 微信端审批提示与 allow/deny 闭环已在真实会话中验证通过

当前结论：

- 本计划的 MVP 范围已完成并达到验收标准
- 后续如有新增工作，主要为体验优化、补充文档细节或扩展能力，不再属于当前 MVP 阻塞项

### 2026-04-19 14:11:18 +08:00

当前落地状态：

- 已创建分支：`feat/wx-channel`
- 已完成 built-in weixin plugin 接入
- 已完成 `ccb weixin serve|login|access pair` CLI 链路
- 已完成 weixin MCP stdio server、消息轮询、`reply` / `send_typing`
- 已完成 `--channels plugin:weixin@builtin` 启用链路
- 已完成 ChannelsNotice 对 builtin plugin 的误报修复
- 已完成 permission relay：
  - server 声明 `experimental["claude/channel/permission"]`
  - 接收 `notifications/claude/channel/permission_request`
  - 通过微信发送审批提示
  - 解析 `yes/no <request_id>`
  - 回发 `notifications/claude/channel/permission`
- 已修复 permission relay 的两个关键问题：
  - 不再把权限请求盲发给“最后活跃聊天”，而是携带当前会话最近 channel 消息的 `chat_id/source_server` 作为路由提示
  - `claude/channel/permission` 的 capability 判定已统一为 truthy 语义

当前验证状态：

- `bun run typecheck` 已通过
- `bun run build` 已通过
- weixin 相关定向测试已通过
- 当前剩余工作主要是继续做手工 E2E，确认微信端审批提示与 allow/deny 闭环在真实会话里稳定可用

## 架构决策

### 采用 built-in plugin，而不是外部 marketplace 插件

原因：

- 本仓库已有内建插件注册链路：`src/plugins/builtinPlugins.ts`、`src/plugins/bundled/index.ts`
- 本仓库已有 channels 协议与 gate：`src/services/mcp/channelNotification.ts`、`src/services/mcp/useManageMCPConnections.ts`
- `cc-weixin` 已具备 `experimental["claude/channel"]` 能力与 `notifications/claude/channel` 通道契约
- 内建插件更容易跨平台启动内部 MCP server，不依赖 `${CLAUDE_PLUGIN_ROOT}` 或 `/bin/sh`

### MVP 范围

包含：

- 微信登录与状态管理
- 微信消息轮询与入站推送
- `reply` / `send_typing` 工具
- `--channels plugin:weixin@builtin` 启用链路
- 微信端 permission relay（审批提示 + yes/no 回复）
- 文档与测试补齐

不包含：

- 通用 plugin userConfig 面板化

## 主仓库新增文件

建议新增目录：`src/services/weixin/`

新增文件：

- `src/services/weixin/types.ts`
- `src/services/weixin/accounts.ts`
- `src/services/weixin/api.ts`
- `src/services/weixin/login.ts`
- `src/services/weixin/cliLogin.ts`
- `src/services/weixin/media.ts`
- `src/services/weixin/monitor.ts`
- `src/services/weixin/pairing.ts`
- `src/services/weixin/send.ts`
- `src/services/weixin/server.ts`
- `src/plugins/bundled/weixin.ts`
- `src/types/qrcode-terminal.d.ts`（如需要）

## 主仓库需修改文件

- `package.json`
  - 添加 `qrcode-terminal`
- `src/plugins/bundled/index.ts`
  - 注册 built-in weixin plugin
- `src/main.tsx`
  - 增加内部 server 启动入口（建议 `weixin serve`）
- `src/services/mcp/channelAllowlist.ts`
  - 让 `weixin@builtin` 能通过内建来源校验
- `src/services/mcp/__tests__/channelNotification.test.ts`
  - 增加 builtin weixin 场景
- `README.md`
- `docs/features/channels.md`
  - 补微信启用说明

## 从 cc-weixin 迁入的文件来源

优先迁入：

- `plugins/weixin/src/types.ts`
- `plugins/weixin/src/accounts.ts`
- `plugins/weixin/src/api.ts`
- `plugins/weixin/src/login.ts`
- `plugins/weixin/src/media.ts`
- `plugins/weixin/src/monitor.ts`
- `plugins/weixin/src/pairing.ts`
- `plugins/weixin/src/send.ts`

需改造后迁入：

- `plugins/weixin/server.ts`
- `plugins/weixin/src/cli-login.ts`

不直接迁入：

- `.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`
- `.mcp.json`

## Capability 与协议

### MVP 必需

在 weixin MCP server 中保留：

```ts
capabilities.experimental["claude/channel"] = {}
```

支持的协议：

- 入站推送：`notifications/claude/channel`
- 工具：`reply`、`send_typing`

### 当前已实现的增强

当前 weixin MCP server 已实现：

```ts
capabilities.experimental["claude/channel/permission"] = {}
```

并已补齐：

- `notifications/claude/channel/permission_request`
- `notifications/claude/channel/permission`

## 用户侧启用方式

1. 在 `/plugin` 启用 built-in `weixin`
2. 运行 weixin 登录/配置 skill
3. 启动会话时传入：

```bash
ccb --channels plugin:weixin@builtin
```

## 实施顺序

1. 迁入 `src/services/weixin/*` 业务层
2. 改造 `server.ts` 为主仓库内部 MCP server
3. 在 `src/main.tsx` 增加 `weixin serve`
4. 注册 `src/plugins/bundled/weixin.ts`
5. 修改 `channelAllowlist.ts`
6. 补登录 skill / 文档 / 测试
7. 手工 E2E 验证

## 测试计划

### 单元测试

- `accounts.test.ts`
- `pairing.test.ts`
- `media.test.ts`
- `send.test.ts`
- `monitor.test.ts`
- `server.test.ts`

### 集成测试

- built-in plugin 注册与启用
- `--channels plugin:weixin@builtin` gate 流程
- headless / print 路径的 channel 可见性

### 手工 E2E

1. 启用 built-in `weixin`
2. 微信扫码登录
3. 启动 `ccb --channels plugin:weixin@builtin`
4. 微信发消息
5. Claude 会话收到 channel 消息
6. 模型调用 `reply`
7. 微信收到回复

## 风险点

1. `channelAllowlist.ts` 当前偏向 marketplace plugin，需要对 `builtin` 来源做兼容
2. built-in plugin 需要稳定的内部 server 启动入口，不能依赖外部插件目录
3. Windows 下不能复用 `/bin/sh` 启动链路
4. `qrcode-terminal` 需要补类型与依赖
5. 登录状态目录若继续使用 `~/.claude/channels/weixin/`，需确认是否接受

## 验收标准

- `weixin` 能作为 built-in plugin 出现在本仓库插件体系中
- `ccb --channels plugin:weixin@builtin` 可注册 channel
- 微信消息能进入 Claude Code 会话
- `reply` 工具能把消息发回微信
- 类型检查与相关测试通过
