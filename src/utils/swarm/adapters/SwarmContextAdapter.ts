// SwarmContextAdapter — 桥接 src/ 上下文构建到 AgentCore 的 ContextDep
// 队友使用自定义系统提示 + team context

import type { ContextDep, SystemPrompt } from '@anthropic/agent'
import { getSystemPrompt } from '../../../constants/prompts.js'
import { asSystemPrompt } from '../../../utils/systemPromptType.js'

export interface SwarmContextConfig {
  /** 队友的 TEAMMATE_SYSTEM_PROMPT_ADDENDUM */
  teammatePromptAddendum: string
  /** 额外的用户上下文 */
  userContext?: Record<string, string>
  /** 额外的系统上下文 */
  systemContext?: Record<string, string>
}

/**
 * 创建队友的 ContextDep 实现
 *
 * 使用 src/ 的 getSystemPrompt() 获取基础系统提示，
 * 追加 TEAMMATE_SYSTEM_PROMPT_ADDENDUM
 */
export function createSwarmContextAdapter(config: SwarmContextConfig): ContextDep {
  return {
    getSystemPrompt(): SystemPrompt[] {
      const basePrompt = getSystemPrompt() as unknown as SystemPrompt[]
      // 追加队友通信指引
      const teammatePrompt = asSystemPrompt(config.teammatePromptAddendum)
      return [...basePrompt, teammatePrompt as SystemPrompt]
    },

    getUserContext(): Record<string, string> {
      return config.userContext ?? {}
    },

    getSystemContext(): Record<string, string> {
      return config.systemContext ?? {}
    },
  }
}
