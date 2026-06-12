// 纯类型定义。无运行时依赖。

/** Workflow 工具输入。 */
export type WorkflowInput = {
  /** 内联脚本源码。 */
  script?: string
  /** 命名 workflow（解析到 .claude/workflows/<name>.ts|js|mjs）。 */
  name?: string
  /** 已有脚本文件绝对路径。 */
  scriptPath?: string
  /** 透传给脚本的 args 全局变量（任意 JSON 值）。 */
  args?: unknown
  /** resume 指定 run，重放 journal。 */
  resumeFromRunId?: string
  /** 工具调用描述（3-5 词）。 */
  description?: string
  /** 进度查看器标题。 */
  title?: string
}

/** 脚本 `export const meta = {...}` 的形状（必须是纯字面量）。 */
export type WorkflowMeta = {
  name: string
  description: string
  whenToUse?: string
  phases?: Array<{ title: string; detail?: string }>
}

/** agent() 传给 AgentRunner 的参数。 */
export type AgentRunParams = {
  prompt: string
  /** JSON Schema；提供时 agent 返回校验对象而非文本。 */
  schema?: object
  model?: string
  /** 自定义子 agent 类型（从 registry 解析）。 */
  agentType?: string
  isolation?: 'worktree'
  allowedTools?: string[]
  /** 仅展示用，不计入 journal key。 */
  label?: string
  /** 仅展示用，不计入 journal key。 */
  phase?: string
}

/** AgentRunner 返回。 */
export type AgentRunResult =
  | { kind: 'ok'; output: string | object; usage: { outputTokens: number } }
  | { kind: 'skipped' }
  | { kind: 'dead' }

/** journal 中单条记录（按执行顺序）。 */
export type JournalEntry = {
  key: string
  result: AgentRunResult
}

/** 进度事件。所有变体携带 runId，供 adapter 路由到对应 task（多并发 workflow）。 */
export type ProgressEvent =
  | {
      type: 'run_started'
      runId: string
      workflowName: string
      meta: WorkflowMeta | null
    }
  | { type: 'phase_started'; runId: string; phase: string }
  | { type: 'phase_done'; runId: string; phase: string }
  | { type: 'agent_started'; runId: string; label?: string; phase?: string }
  | {
      type: 'agent_done'
      runId: string
      label?: string
      phase?: string
      result: AgentRunResult
    }
  | { type: 'log'; runId: string; message: string }
  | {
      type: 'run_done'
      runId: string
      status: 'completed' | 'failed' | 'killed'
      returnValue?: unknown
      error?: string
    }

/** 引擎运行结果。 */
export type WorkflowRunResult = {
  status: 'completed' | 'failed' | 'killed'
  returnValue?: unknown
  error?: string
}
