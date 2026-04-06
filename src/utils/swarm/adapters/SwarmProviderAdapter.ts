// SwarmProviderAdapter — 桥接 src/ API client 到 AgentCore 的 ProviderDep
// 每个 in-process 队友共享同一个 API client，但可以有独立的 model

import type { ProviderDep, ProviderStreamParams, ProviderEvent } from '@anthropic/agent'
import { streamAssistantResponse } from '../../../services/api/claude.js'

export interface SwarmProviderConfig {
  /** 队友使用的模型（覆盖默认） */
  model?: string
}

/**
 * 创建队友的 ProviderDep 实现
 *
 * 将 src/ 的 streamAssistantResponse() 包装为 AgentCore 期望的
 * AsyncIterable<ProviderEvent> 接口
 */
export function createSwarmProviderAdapter(config: SwarmProviderConfig): ProviderDep {
  return {
    async *stream(params: ProviderStreamParams): AsyncGenerator<ProviderEvent> {
      // 将 AgentCore 的 ProviderStreamParams 转换为 streamAssistantResponse 的参数
      for await (const event of streamAssistantResponse({
        systemPrompt: params.systemPrompt,
        messages: params.messages,
        tools: params.tools,
        model: params.model,
        maxTokens: params.maxTokens,
        temperature: params.temperature,
        abortSignal: params.abortSignal,
        ...params,
      })) {
        yield event as ProviderEvent
      }
    },

    getModel(): string {
      return config.model ?? 'claude-sonnet-4-6'
    },
  }
}
