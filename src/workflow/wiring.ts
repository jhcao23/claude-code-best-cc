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
function buildWorkflowTool(): Tool {
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

// 单例：tools.ts 注册与 PermissionRequest 引用需为同一实例（switch 按引用匹配），
// 且共享同一个 adapter（bindings 映射）。
let cached: Tool | null = null

export function createWorkflowToolCore(): Tool {
  if (!cached) cached = buildWorkflowTool()
  return cached
}
