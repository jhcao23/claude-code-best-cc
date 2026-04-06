// buildSwarmDeps — 聚合所有适配器，构造 AgentDeps
// 这是 in-process 队友从 runAgent() 迁移到 AgentCore 的关键入口

import type { AgentDeps, SwarmDep, TeammateIdentity } from '@anthropic/agent'
import type { Tool } from '../../../Tool.js'
import type { CanUseToolFn } from '../../../hooks/useCanUseTool.js'
import { TEAMMATE_SYSTEM_PROMPT_ADDENDUM } from '../teammatePromptAddendum.js'
import { createSwarmProviderAdapter } from './SwarmProviderAdapter.js'
import { createSwarmToolAdapter } from './SwarmToolAdapter.js'
import { createSwarmPermissionAdapter } from './SwarmPermissionAdapter.js'
import { createSwarmCompactionAdapter } from './SwarmCompactionAdapter.js'
import { createSwarmContextAdapter } from './SwarmContextAdapter.js'
import { createSwarmHookAdapter } from './SwarmHookAdapter.js'
import { createSwarmSessionAdapter } from './SwarmSessionAdapter.js'
import { createSwarmOutputAdapter } from './SwarmOutputAdapter.js'
import { createSwarmMailboxAdapter } from './SwarmMailboxAdapter.js'
import { createSwarmTaskClaimingAdapter } from './SwarmTaskClaimingAdapter.js'

export interface SwarmDepsConfig {
  // --- 队友身份 ---
  /** 队友名称 */
  agentName: string
  /** 团队名称 */
  teamName: string
  /** 队友 agent ID */
  agentId: string
  /** 颟色 */
  color?: string
  /** 是否需要 plan mode */
  planModeRequired?: boolean

  // --- 模型配置 ---
  /** 模型覆盖 */
  model?: string

  // --- 工具集 ---
  /** 获取队友可用工具列表 */
  getTools: () => Tool[]

  // --- 权限 ---
  /** 已创建的 canUseTool 函数（来自 createInProcessCanUseTool） */
  canUseTool: CanUseToolFn

  // --- 会话 ---
  /** session ID */
  sessionId?: string

  // --- 上下文 ---
  /** 额外用户上下文 */
  userContext?: Record<string, string>
  /** 额外系统上下文 */
  systemContext?: Record<string, string>

  // --- 控制 ---
  /** abort signal */
  abortSignal?: AbortSignal
  /** 是否非交互式 */
  isNonInteractiveSession?: boolean

  // --- Hook ---
  /** turn 开始回调 */
  onTurnStart?: (state: never) => Promise<void>
  /** turn 结束回调 */
  onTurnEnd?: (state: never) => Promise<void>
}

/**
 * 构造 in-process 队友的完整 AgentDeps
 *
 * 将所有适配器聚合为一个满足 AgentDeps 接口的对象，
 * 使 inProcessRunner 可以使用 `new AgentCore(deps)` 替代 `runAgent()`
 */
export function buildSwarmDeps(config: SwarmDepsConfig): AgentDeps {
  const teammateIdentity: TeammateIdentity = {
    name: config.agentName,
    teamId: config.teamName,
    teammateId: config.agentId,
    role: 'worker',
  }

  const swarmDep: SwarmDep = {
    identity: teammateIdentity,
    mailbox: createSwarmMailboxAdapter({
      agentName: config.agentName,
      teamName: config.teamName,
      abortSignal: config.abortSignal,
    }),
    taskClaiming: createSwarmTaskClaimingAdapter({
      teamName: config.teamName,
    }),
  }

  return {
    provider: createSwarmProviderAdapter({
      model: config.model,
    }),

    tools: createSwarmToolAdapter({
      getTools: config.getTools,
    }),

    permission: createSwarmPermissionAdapter({
      canUseTool: config.canUseTool,
    }),

    output: createSwarmOutputAdapter(),

    hooks: createSwarmHookAdapter({
      onTurnStart: config.onTurnStart as never,
      onTurnEnd: config.onTurnEnd as never,
    }),

    compaction: createSwarmCompactionAdapter({
      isNonInteractiveSession: config.isNonInteractiveSession,
      abortSignal: config.abortSignal,
    }),

    context: createSwarmContextAdapter({
      teammatePromptAddendum: TEAMMATE_SYSTEM_PROMPT_ADDENDUM,
      userContext: config.userContext,
      systemContext: config.systemContext,
    }),

    session: createSwarmSessionAdapter({
      sessionId: config.sessionId,
    }),

    swarm: swarmDep,
  }
}
