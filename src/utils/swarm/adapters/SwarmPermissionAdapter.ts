// SwarmPermissionAdapter — 桥接 src/ 权限系统到 AgentCore 的 PermissionDep
// 队友的权限处理：优先通过 Leader UI 桥接，fallback 到 mailbox

import type { PermissionDep, CoreTool, PermissionResult, PermissionContext } from '@anthropic/agent'
import type { PermissionDecision } from '../../../types/permissions.js'
import type { CanUseToolFn } from '../../../hooks/useCanUseTool.js'

export interface SwarmPermissionConfig {
  /**
   * 创建好的 canUseTool 函数（来自 inProcessRunner.ts 的 createInProcessCanUseTool）
   * 已包含 Leader UI 桥接 + mailbox fallback 逻辑
   */
  canUseTool: CanUseToolFn
}

/**
 * 创建队友的 PermissionDep 实现
 *
 * 将 inProcessRunner 中已实现的权限桥接逻辑包装为 PermissionDep 接口
 */
export function createSwarmPermissionAdapter(config: SwarmPermissionConfig): PermissionDep {
  return {
    async canUseTool(
      tool: CoreTool,
      input: unknown,
      context: PermissionContext,
    ): Promise<PermissionResult> {
      const decision: PermissionDecision = await config.canUseTool(
        tool as never,
        input,
        context as never,
        undefined,
        undefined,
        undefined,
      )

      return {
        allowed: decision.behavior === 'allow',
        reason: decision.message,
        updatedInput: decision.updatedInput,
      }
    },
  }
}
