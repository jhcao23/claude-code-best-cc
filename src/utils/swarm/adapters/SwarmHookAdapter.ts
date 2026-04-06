// SwarmHookAdapter — 桥接 src/ hook 系统到 AgentCore 的 HookDep
// 队友的 turn 生命周期 + stop hook

import type { HookDep, StopHookContext, StopHookResult, CoreMessage } from '@anthropic/agent'
import type { AgentState } from '@anthropic/agent'

export interface SwarmHookConfig {
  /** Turn 开始回调 */
  onTurnStart?: (state: AgentState) => Promise<void>
  /** Turn 结束回调 */
  onTurnEnd?: (state: AgentState) => Promise<void>
  /** Stop hook — 默认允许继续 */
  onStop?: (messages: CoreMessage[], context: StopHookContext) => Promise<StopHookResult>
}

/**
 * 创建队友的 HookDep 实现
 *
 * 默认行为：所有 hook 都 pass-through，不阻止继续
 */
export function createSwarmHookAdapter(config: SwarmHookConfig = {}): HookDep {
  return {
    async onTurnStart(state: AgentState): Promise<void> {
      await config.onTurnStart?.(state)
    },

    async onTurnEnd(state: AgentState): Promise<void> {
      await config.onTurnEnd?.(state)
    },

    async onStop(messages: CoreMessage[], context: StopHookContext): Promise<StopHookResult> {
      if (config.onStop) {
        return config.onStop(messages, context)
      }
      return { blockingErrors: [], preventContinuation: false }
    },
  }
}
