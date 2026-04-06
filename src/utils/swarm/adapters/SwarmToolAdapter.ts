// SwarmToolAdapter — 桥接 src/ 工具注册表到 AgentCore 的 ToolDep
// 队友使用受限工具集 + swarm 专用工具

import type { ToolDep, CoreTool, ToolResult, ToolExecContext } from '@anthropic/agent'
import type { Tool } from '../../../Tool.js'

export interface SwarmToolConfig {
  /** 获取可用工具列表（已过滤的队友工具集） */
  getTools: () => Tool[]
}

/**
 * 创建队友的 ToolDep 实现
 *
 * 使用 Tool 对象（满足 CoreTool 接口）提供工具查找、列表和执行
 */
export function createSwarmToolAdapter(config: SwarmToolConfig): ToolDep {
  let cachedTools: CoreTool[] | null = null

  return {
    find(name: string): CoreTool | undefined {
      const tools = this.list()
      return tools.find(t => t.name === name)
    },

    list(): CoreTool[] {
      if (!cachedTools) {
        cachedTools = config.getTools() as unknown as CoreTool[]
      }
      return cachedTools
    },

    async execute(tool: CoreTool, input: unknown, context: ToolExecContext): Promise<ToolResult> {
      const srcTool = tool as unknown as Tool
      // ToolUseContext 需要从 context 中重建
      // 这里 context 是简化的 ToolExecContext
      const result = await srcTool.call(input as never, context as never)
      return result as ToolResult
    },
  }
}
