# @anthropic/agent

一个与提供者无关的 AI 代理循环包。它实现了 agentic loop 的核心 LLM → tool → response 周期，并通过依赖注入实现了零运行时依赖。

## 安装

```bash
# 在 monorepo 中
bun add @anthropic/agent
# 或者
npm install @anthropic/agent
```

> **注意：** 此包是 `claude-code` monorepo 的一部分，目前标记为 `private: true`。

## 核心概念

`@anthropic/agent` 围绕两个主要类和一组注入的依赖项进行组织：

| 概念            | 作用                                                        |
| --------------- | ----------------------------------------------------------- |
| `AgentCore`     | **公共入口点** — 持有依赖项，管理状态，并公开 `run()`       |
| `AgentLoop`     | **内部循环引擎** — 处理实际的 LLM 调用 → 工具执行周期       |
| `AgentDeps`     | **依赖接口** — 你实现这些；agent 不导入任何外部模块         |
| `AgentEvent`    | **输出类型** — 一个从 `run()` 产生的统一事件流               |

代理不拥有 Anthropic SDK、任何 LLM 提供者或工具实现。所有东西都是通过 `AgentDeps` 注入的。

## 快速开始

### 1. 实现 `AgentDeps`

`AgentDeps` 有 8 个子接口。以下是一个最小的真实实现：

```typescript
import type {
  AgentDeps,
  ProviderStreamParams,
  ProviderEvent,
  CoreTool,
  ToolResult,
  ToolExecContext,
  PermissionResult,
  PermissionContext,
  CoreMessage,
  CompactionResult,
  StopHookResult,
} from '@anthropic/agent'

// --- Provider: 封装你的 LLM API ---
const provider: AgentDeps['provider'] = {
  getModel: () => 'claude-sonnet-4-6',
  async *stream(params: ProviderStreamParams): AsyncIterable<ProviderEvent> {
    // 调用你的 LLM API 并 yield 原始流事件
    // 例如，使用 Anthropic SDK：
    const client = new Anthropic()
    const stream = client.messages.stream({
      model: params.model,
      system: params.systemPrompt as string,
      messages: params.messages as any[],
      tools: params.tools as any[],
      max_tokens: 4096,
    })

    for await (const event of stream) {
      yield event as ProviderEvent
    }
  },
}

// --- Tools: 注册和执行工具 ---
const tools: AgentDeps['tools'] = {
  find(name: string): CoreTool | undefined {
    return registeredTools.get(name)
  },
  async execute(tool: CoreTool, input: unknown, ctx: ToolExecContext): Promise<ToolResult> {
    // 分发到你的工具处理器
    const handler = toolHandlers.get(tool.name)
    if (!handler) return { output: `Unknown tool: ${tool.name}`, error: true }
    try {
      const result = await handler(input, ctx)
      return { output: result }
    } catch (err) {
      return { output: String(err), error: true }
    }
  },
}

// --- Permission: 门控工具执行 ---
const permission: AgentDeps['permission'] = {
  async canUseTool(tool: CoreTool, input: unknown, ctx: PermissionContext): Promise<PermissionResult> {
    // 你自定义的权限逻辑
    return { allowed: true }
  },
}

// --- Hooks: 生命周期回调 ---
const hooks: AgentDeps['hooks'] = {
  async onTurnStart(state) {},
  async onTurnEnd(state) {},
  async onStop(messages, ctx): Promise<StopHookResult> {
    return { blockingErrors: [], preventContinuation: false }
  },
}

// --- Compaction: 上下文压缩 ---
const compaction: AgentDeps['compaction'] = {
  async maybeCompact(messages: CoreMessage[], tokenCount: number): Promise<CompactionResult> {
    // 可选：在消息过长时进行总结/截断
    return { compacted: false, messages }
  },
}

// --- Context: 系统提示和环境 ---
const context: AgentDeps['context'] = {
  getSystemPrompt: () => [{ content: 'You are a helpful assistant.' }],
  getUserContext: () => ({}),
  getSystemContext: () => ({}),
}

// --- Output: 事件接收器 ---
const output: AgentDeps['output'] = {
  emit(event: unknown) {
    // 发送到你的 UI、日志记录器等。
  },
}

// --- Session: 持久化 ---
const session: AgentDeps['session'] = {
  async recordTranscript(messages: CoreMessage[]) {},
  getSessionId: () => crypto.randomUUID(),
}
```

### 2. 创建一个 `AgentCore` 并运行

```typescript
import { AgentCore } from '@anthropic/agent'
import type { AgentEvent } from '@anthropic/agent'

const deps: AgentDeps = { provider, tools, permission, hooks, compaction, context, output, session }

const agent = new AgentCore(deps, {
  model: 'claude-sonnet-4-6',      // 可选：覆盖从 deps 派生的值
  sessionId: 'my-session-123',
  totalUsage: { input_tokens: 0, output_tokens: 0 },
})

// 运行 agentic 循环
const abortController = new AbortController()

for await (const event of agent.run({
  prompt: 'List all files in the current directory',
  messages: [],
  maxTurns: 10,
  abortSignal: abortController.signal,
  tokenBudget: 100_000,
})) {
  handleEvent(event)
}

function handleEvent(event: AgentEvent) {
  switch (event.type) {
    case 'message':
      // 一个完整的用户或助手消息
      console.log('Message:', event.message)
      break
    case 'stream':
      // 来自 LLM 的原始流增量
      process.stdout.write('.')
      break
    case 'tool_start':
      console.log(`Running tool: ${event.toolName}`)
      break
    case 'tool_result':
      console.log(`Tool result:`, event.result.output)
      break
    case 'compaction':
      console.log(`Context compacted, saved ${event.before.length - event.after.length} messages`)
      break
    case 'done':
      console.log(`Done: ${event.reason}`)
      if (event.usage) {
        console.log(`Tokens — input: ${event.usage.input_tokens}, output: ${event.usage.output_tokens}`)
      }
      break
  }
}
```

### 3. 中断正在运行的代理

```typescript
// 从其他地方（例如，UI 按钮，超时）
abortController.abort()

// 或者：
agent.interrupt()
```

## 代理循环

每次调用 `run()` 都会执行此循环：

```
┌─────────────────────────────────────────────────┐
│  1. Build context (system prompt + messages)     │
│  2. Call LLM via deps.provider.stream()          │
│  3. Yield stream / message events                │
│  4. Check for tool_use blocks in response        │
│     ├─ No tools → check token budget, yield done │
│     └─ Has tools ↓                               │
│  5. Permission check (deps.permission.canUseTool)│
│  6. Execute tool (deps.tools.execute)            │
│  7. Yield tool_start / tool_result events        │
│  8. Context compaction (deps.compaction)         │
│  9. → Loop back to step 1                       │
└─────────────────────────────────────────────────┘
```

## 事件类型

| Event                | 描述                                       |
| -------------------- | ------------------------------------------ |
| `request_start`      | 即将发出一个 LLM API 调用                  |
| `stream`             | 来自 LLM 的原始流增量                      |
| `message`            | 一个完整的用户或助手消息                   |
| `tool_start`         | 工具即将被执行                             |
| `tool_progress`      | 工具执行的进度更新（可选）                 |
| `tool_result`        | 工具执行完成                               |
| `permission_request` | 等待用户批准（由你处理）                   |
| `compaction`         | 消息列表被压缩                             |
| `done`               | 循环终止                                   |

### 完成原因

| Reason         | 含义                                   |
| -------------- | -------------------------------------- |
| `end_turn`     | LLM 返回了 `end_turn`，没有工具调用    |
| `max_turns`    | 达到 `AgentInput.maxTurns` 限制        |
| `interrupted`  | 调用了 `abortSignal.abort()` 或 `agent.interrupt()` |
| `error`        | 未捕获的错误                           |
| `stop_hook`    | `deps.hooks.onStop()` 阻止了继续       |
| `budget`       | Token 预算已耗尽                       |

## 定义工具

工具实现 `CoreTool` 接口：

```typescript
import type { CoreTool } from '@anthropic/agent'

const readFileTool: CoreTool = {
  name: 'read_file',
  description: 'Read the contents of a file',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to read' },
    },
    required: ['path'],
  },
}
```

在 `deps.tools.find()` 中注册你的工具，并在 `deps.tools.execute()` 中处理执行。

## API 参考

### `AgentCore`

```typescript
new AgentCore(deps: AgentDeps, initialState?: Partial<AgentState>)
```

| 方法             | 签名                                     | 描述                 |
| ---------------- | ---------------------------------------- | -------------------- |
| `run`            | `(input: AgentInput) => AsyncGenerator<AgentEvent>` | 执行代理循环 |
| `interrupt`      | `() => void`                             | 信号中断             |
| `getMessages`    | `() => readonly CoreMessage[]`           | 只读消息列表         |
| `getState`       | `() => AgentState`                       | 不可变状态快照       |
| `setModel`       | `(model: string) => void`                | 更改 LLM 模型        |

### `AgentInput`

| 字段           | 类型                           | 默认值    | 描述                     |
| -------------- | ------------------------------ | --------- | ------------------------ |
| `prompt`       | `string?`                      | —         | 初始用户提示             |
| `messages`     | `CoreMessage[]`                | required  | 对话历史                 |
| `maxTurns`     | `number?`                      | `Infinity`| 代理循环的最大迭代次数   |
| `abortSignal`  | `AbortSignal?`                 | —         | 用于取消                 |
| `tokenBudget`  | `number \| null?`              | `null`    | token 预算限制           |
| `attachments`  | `Array<{ type: string; ... }>?`| —         | 附加到用户消息的附件     |

### `AgentState`

| 字段          | 类型                       | 描述                 |
| ------------- | -------------------------- | -------------------- |
| `messages`    | `readonly CoreMessage[]`   | 当前消息列表         |
| `turnCount`   | `number`                   | 已完成的轮次         |
| `totalUsage`  | `Usage`                    | 累计 token 使用量    |
| `model`       | `string`                   | 当前模型 ID          |
| `sessionId`   | `string`                   | 会话标识符           |

## 测试

此包使用 Bun 测试和模拟依赖项。运行：

```bash
bun test packages/agent
```

模拟工厂 (`createMockDeps`) 和标准事件夹具 (`END_TURN_EVENTS`、`createToolUseStreamEvents`) 在 `__tests__/fixtures/mockDeps.ts` 中可用。

## 架构

```
packages/agent/
├── index.ts            # 公共导出
├── core/
│   ├── AgentCore.ts    # 入口点 — 状态管理，run/interrupt API
│   └── AgentLoop.ts    # 循环引擎 — LLM → tool 周期
├── types/
│   ├── deps.ts         # AgentDeps 及所有子接口
│   ├── events.ts       # AgentEvent 联合类型
│   ├── messages.ts     # CoreMessage 类型
│   ├── state.ts        # AgentState, AgentInput, TurnState
│   └── tools.ts        # CoreTool, ToolResult, permission 类型
├── internal/
│   ├── abort.ts        # 中断处理，合成的工具结果
│   ├── config.ts       # 不可变运行时配置
│   ├── queue.ts        # 命令队列
│   ├── tokenBudget.ts  # Token 预算跟踪
│   └── transitions.ts  # 循环转换决策
└── __tests__/
    ├── AgentCore.test.ts
    ├── AgentLoop.test.ts
    ├── tokenBudget.test.ts
    └── fixtures/
        └── mockDeps.ts  # 共享模拟工厂
```

## 许可证

此项目是 Claude Code monorepo 的一部分。
