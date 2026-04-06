// SwarmSessionAdapter — 桥接 src/ session 管理到 AgentCore 的 SessionDep
// 队友使用独立的 session ID

import type { SessionDep, CoreMessage } from '@anthropic/agent'
import { getSessionId } from '../../../bootstrap/state.js'

export interface SwarmSessionConfig {
  /** 队友的独立 session ID（默认使用 getSessionId()） */
  sessionId?: string
}

/**
 * 创建队友的 SessionDep 实现
 *
 * 使用 src/ 的 getSessionId() 或自定义 session ID
 */
export function createSwarmSessionAdapter(config: SwarmSessionConfig = {}): SessionDep {
  return {
    async recordTranscript(_messages: CoreMessage[]): Promise<void> {
      // 队友的转录记录由 inProcessRunner 中的 appendTeammateMessage 处理
      // 这里是 no-op，因为转录逻辑在 AgentCore 外部管理
    },

    getSessionId(): string {
      return config.sessionId ?? getSessionId()
    },
  }
}
