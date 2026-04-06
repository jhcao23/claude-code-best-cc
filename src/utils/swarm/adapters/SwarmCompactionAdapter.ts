// SwarmCompactionAdapter — 桥接 src/ compaction 到 AgentCore 的 CompactionDep
// 队友使用独立的压缩逻辑，带消息上限

import type { CompactionDep, CompactionResult, CoreMessage } from '@anthropic/agent'
import { getAutoCompactThreshold } from '../../../services/compact/autoCompact.js'
import {
  buildPostCompactMessages,
  compactConversation,
  ERROR_MESSAGE_USER_ABORT,
} from '../../../services/compact/compact.js'
import { resetMicrocompactState } from '../../../services/compact/microCompact.js'
import { tokenCountWithEstimation } from '../../../utils/tokens.js'

export interface SwarmCompactionConfig {
  /** 是否为非交互式会话 */
  isNonInteractiveSession?: boolean
  /** abort signal */
  abortSignal?: AbortSignal
  /** 获取当前 AppState 的工具权限上下文 */
  getToolPermissionContext?: () => unknown
}

/**
 * 创建队友的 CompactionDep 实现
 *
 * 包装 src/ 的 compactConversation 为 CompactionDep.maybeCompact() 接口
 */
export function createSwarmCompactionAdapter(config: SwarmCompactionConfig): CompactionDep {
  return {
    async maybeCompact(messages: CoreMessage[], tokenCount: number): Promise<CompactionResult> {
      const threshold = getAutoCompactThreshold()

      // 未达阈值，跳过压缩
      if (tokenCount < threshold) {
        return { compacted: false, messages }
      }

      try {
        // resetMicrocompactState 需要在压缩前调用
        resetMicrocompactState()

        const result = await compactConversation(
          messages as never[],
          config.abortSignal,
          config.getToolPermissionContext?.(),
        )

        if (result === ERROR_MESSAGE_USER_ABORT) {
          return { compacted: false, messages }
        }

        const compactedMessages = buildPostCompactMessages(
          messages as never[],
          result as never[],
        ) as unknown as CoreMessage[]

        const newTokenCount = tokenCountWithEstimation(compactedMessages as never[])
        return {
          compacted: true,
          messages: compactedMessages,
          tokensSaved: tokenCount - newTokenCount,
        }
      } catch {
        return { compacted: false, messages }
      }
    },
  }
}
