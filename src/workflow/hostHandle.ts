import {
  createHostHandle,
  unwrapHostHandle,
  type HostHandle,
} from '@claude-code-best/workflow-engine'
import type { CanUseToolFn } from '../hooks/useCanUseTool.js'
import type { AssistantMessage } from '../types/message.js'
import type { AgentId } from '../types/ids.js'
import type { ToolUseContext } from '../Tool.js'

/** HostHandle 内含的不透明 bundle（核心侧解包后使用）。 */
export type WorkflowHostBundle = {
  toolUseContext: ToolUseContext
  canUseTool: CanUseToolFn
  parentMessage: AssistantMessage
  agentId?: AgentId
}

export function makeHostHandle(bundle: WorkflowHostBundle): HostHandle {
  return createHostHandle(bundle)
}

export function readHostBundle(handle: HostHandle): WorkflowHostBundle {
  return unwrapHostHandle(handle) as WorkflowHostBundle
}
