import { createWorkflowAdapter } from './adapter.js'
import {
  createWorkflowTool,
  type WorkflowToolDescriptor,
} from '@claude-code-best/workflow-engine'
import { buildTool, type Tool } from '../Tool.js'

/**
 * 把包的自包含描述符适配为 buildTool 兼容的 Tool。
 * 描述符的 call 签名 (input, context, canUseTool, parentMessage, onProgress) 与 Tool.call 一致。
 */
export function createWorkflowToolCore(): Tool {
  const adapter = createWorkflowAdapter()
  const descriptor: WorkflowToolDescriptor = createWorkflowTool(adapter)

  return buildTool({
    name: descriptor.name,
    maxResultSizeChars: 50_000,
    inputSchema: descriptor.inputSchema,
    isEnabled: () => descriptor.isEnabled(),
    isReadOnly: input => descriptor.isReadOnly(input),
    isConcurrencySafe: () => true,
    async description() {
      return descriptor.description()
    },
    async prompt() {
      return descriptor.prompt()
    },
    async call(input, context, canUseTool, parentMessage, onProgress) {
      const result = await descriptor.call(
        input,
        context,
        canUseTool,
        parentMessage,
        onProgress,
      )
      return { data: result.data }
    },
    renderToolUseMessage: input => descriptor.renderToolUseMessage(input),
    mapToolResultToToolResultBlockParam: (data, toolUseId) =>
      descriptor.mapToolResultToToolResultBlockParam(data, toolUseId),
  })
}
