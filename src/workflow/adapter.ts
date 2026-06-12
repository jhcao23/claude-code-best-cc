import {
  createFileJournalStore,
  type AgentRunParams,
  type AgentRunResult,
  type HostHandle,
  type ProgressEvent,
  type WorkflowHostContext,
  type WorkflowPorts,
} from '@claude-code-best/workflow-engine'
import { getCwd } from '../utils/cwd.js'
import { logForDebugging } from '../utils/debug.js'
import { getProjectRoot } from '../bootstrap/state.js'
import { logEvent } from '../services/analytics/index.js'
import { assembleToolPool } from '../tools.js'
import { finalizeAgentTool } from '@claude-code-best/builtin-tools/tools/AgentTool/agentToolUtils.js'
import { runAgent } from '@claude-code-best/builtin-tools/tools/AgentTool/runAgent.js'
import {
  isBuiltInAgent,
  type AgentDefinition,
  type BuiltInAgentDefinition,
} from '@claude-code-best/builtin-tools/tools/AgentTool/loadAgentsDir.js'
import { createUserMessage, extractTextContent } from '../utils/messages.js'
import { createAgentId } from '../utils/uuid.js'
import type { Message } from '../types/message.js'
import type { AppState } from '../state/AppState.js'
import type { SetAppState } from '../Task.js'
import {
  completeWorkflowTask,
  failWorkflowTask,
  killWorkflowTask,
  registerLocalWorkflowTask,
} from '../tasks/LocalWorkflowTask/LocalWorkflowTask.js'
import {
  makeHostHandle,
  readHostBundle,
  type WorkflowHostBundle,
} from './hostHandle.js'
import { applyProgressEvent } from './progressStore.js'
import type { ToolUseContext } from '../Tool.js'

/** workflow 子 agent 的缺省定义（通用研究/执行 agent）。 */
const WORKFLOW_AGENT: BuiltInAgentDefinition = {
  agentType: 'workflow-worker',
  whenToUse: 'workflow 脚本内 agent() 钩子派发的子任务',
  tools: ['*'],
  source: 'built-in',
  baseDir: 'built-in',
  getSystemPrompt: () =>
    'You are a workflow sub-agent. Complete the task concisely; your final text is the return value relayed to the workflow.',
}

type RunBinding = {
  runId: string
  taskId: string
  setAppState: SetAppState
  abortController: AbortController
  workflowName: string
}

/** 每次工具调用从 toolUseContext 构造 WorkflowHostContext。 */
function makeHostFactory(): WorkflowPorts['hostFactory'] {
  return ({ context, canUseTool, parentMessage }): WorkflowHostContext => {
    const ctx = context as ToolUseContext
    return {
      handle: makeHostHandle({
        toolUseContext: ctx,
        canUseTool: canUseTool as WorkflowHostBundle['canUseTool'],
        parentMessage: parentMessage as WorkflowHostBundle['parentMessage'],
        agentId: ctx.agentId,
      }),
      cwd: getCwd(),
      // v1：无 turn 级预算注入点；engine 支持 budget 但此处传 null
      budgetTotal: null,
      toolUseId: ctx.toolUseId,
    }
  }
}

function resolveAgentDefinition(
  agentType: string | undefined,
  toolUseContext: ToolUseContext,
): AgentDefinition {
  if (!agentType) return WORKFLOW_AGENT
  const found = toolUseContext.options.agentDefinitions.activeAgents.find(
    a => a.agentType === agentType,
  )
  return found ?? WORKFLOW_AGENT
}

async function runWorkflowSubAgent(
  params: AgentRunParams,
  host: HostHandle,
): Promise<AgentRunResult> {
  const bundle = readHostBundle(host)
  const { toolUseContext, canUseTool } = bundle
  const appState = toolUseContext.getAppState()
  const agentDef = resolveAgentDefinition(params.agentType, toolUseContext)
  const agentId = createAgentId()

  const workerPermissionContext = {
    ...appState.toolPermissionContext,
    mode: agentDef.permissionMode ?? 'acceptEdits',
  }
  const workerTools = assembleToolPool(
    workerPermissionContext,
    appState.mcp.tools,
  )

  // schema → 通过 prompt 追加 JSON Schema 指令（非交互模式 StructuredOutput 已启用）
  const promptText = params.schema
    ? `${params.prompt}\n\nYou MUST return your final answer by calling the StructuredOutput tool with a value matching this JSON Schema:\n${JSON.stringify(params.schema)}`
    : params.prompt

  const promptMessages = [createUserMessage({ content: promptText })]
  const messages: Message[] = []
  const startTime = Date.now()

  try {
    for await (const msg of runAgent({
      agentDefinition: agentDef,
      promptMessages,
      toolUseContext,
      canUseTool,
      isAsync: true,
      querySource: toolUseContext.options.querySource ?? 'workflow',
      availableTools: workerTools,
      override: { agentId },
      ...(params.model ? { model: params.model as never } : {}),
    })) {
      messages.push(msg as Message)
    }
  } catch (e) {
    logForDebugging(`workflow sub-agent error: ${(e as Error).message}`)
    return { kind: 'dead' }
  }

  const finalized = finalizeAgentTool(messages, agentId, {
    prompt: params.prompt,
    resolvedAgentModel: toolUseContext.options.mainLoopModel,
    isBuiltInAgent: isBuiltInAgent(agentDef),
    startTime,
    agentType: agentDef.agentType,
    isAsync: true,
  })
  const outputTokens =
    finalized.usage?.output_tokens ?? finalized.totalTokens ?? 0

  if (params.schema) {
    const structured = extractStructuredOutput(finalized.content)
    if (structured === null) return { kind: 'dead' }
    return { kind: 'ok', output: structured as object, usage: { outputTokens } }
  }
  const text = extractTextContent(finalized.content, '\n')
  return { kind: 'ok', output: text, usage: { outputTokens } }
}

/** 从 agent 最终消息中提取 StructuredOutput 产出的 JSON 对象；解析失败返回 null。 */
function extractStructuredOutput(
  content: Array<{ type: string; text?: string }>,
): unknown | null {
  for (const block of content) {
    if (block.type === 'text' && block.text) {
      const trimmed = block.text.trim()
      const start = trimmed.indexOf('{')
      const end = trimmed.lastIndexOf('}')
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(trimmed.slice(start, end + 1))
        } catch {
          // 继续
        }
      }
    }
  }
  return null
}

/** 构造完整端口集。adapter 维护 runId → RunBinding 映射供 progress/kill 路由。 */
export function createWorkflowAdapter(): WorkflowPorts {
  const bindings = new Map<string, RunBinding>()
  const runsDir = `${getProjectRoot()}/.claude/workflow-runs`

  return {
    hostFactory: makeHostFactory(),

    agentRunner: {
      runAgentToResult: runWorkflowSubAgent,
    },

    progressEmitter: {
      emit(event: ProgressEvent) {
        applyProgressEvent(event)
      },
    },

    taskRegistrar: {
      register(opts, host) {
        const bundle = readHostBundle(host)
        const setAppState =
          bundle.toolUseContext.setAppStateForTasks ??
          bundle.toolUseContext.setAppState
        const abortController = new AbortController()
        const taskId = registerLocalWorkflowTask(setAppState, {
          description: opts.summary ?? opts.workflowName,
          workflowName: opts.workflowName,
          workflowFile: opts.workflowFile ?? '',
          summary: opts.summary,
          ...(opts.toolUseId ? { toolUseId: opts.toolUseId } : {}),
          abortController,
        })
        const runId = opts.runId ?? taskId
        bindings.set(runId, {
          runId,
          taskId,
          setAppState,
          abortController,
          workflowName: opts.workflowName,
        })
        logEvent('tengu_workflow_started', {})
        return { runId, signal: abortController.signal }
      },

      complete(runId, summary) {
        const b = bindings.get(runId)
        if (!b) return
        completeWorkflowTask(b.taskId, b.setAppState)
        logForDebugging(`workflow ${runId} completed: ${summary ?? ''}`)
      },

      fail(runId, error) {
        const b = bindings.get(runId)
        if (!b) return
        failWorkflowTask(b.taskId, b.setAppState)
        logForDebugging(`workflow ${runId} failed: ${error}`)
      },

      kill(runId) {
        const b = bindings.get(runId)
        if (!b) return
        killWorkflowTask(b.taskId, b.setAppState)
      },

      pendingAction(runId) {
        // v1：skip/retry UI 未接线；从 task 状态读 pendingAgentAction（若有）。
        const b = bindings.get(runId)
        if (!b) return null
        return null
      },
    },

    journalStore: createFileJournalStore(runsDir),

    permissionGate: {
      // 引擎实际用 ctx.signal（register 返回的 AbortController）判定 abort。
      isAborted: () => false,
    },

    logger: {
      debug: msg => logForDebugging(msg),
      event: name => logForDebugging(`workflow event: ${name}`),
    },
  }
}

// 抑制未使用类型导入（AppState 用于 RunBinding.setAppState 类型推导）
export type _AppStateUsed = AppState
