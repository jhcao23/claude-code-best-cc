// SwarmOutputAdapter — 桥接 src/ 输出到 AgentCore 的 OutputDep
// 队友的事件通过 emit 转发到 AppState

import type { OutputDep } from '@anthropic/agent'

export interface SwarmOutputConfig {
  /** 事件发射回调 */
  emit?: (event: unknown) => void
}

/**
 * 创建队友的 OutputDep 实现
 *
 * 默认 no-op，因为队友的事件流由 AgentCore.run() 的 AsyncGenerator 直接消费
 */
export function createSwarmOutputAdapter(config: SwarmOutputConfig = {}): OutputDep {
  return {
    emit(event: unknown): void {
      config.emit?.(event)
    },
  }
}
