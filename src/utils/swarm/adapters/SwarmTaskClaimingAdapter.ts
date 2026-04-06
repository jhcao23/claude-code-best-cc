// SwarmTaskClaimingAdapter — 桥接 src/ 任务系统到 AgentCore 的 TaskClaimingDep
// 队友通过文件系统认领和更新任务

import type { TaskClaimingDep, ClaimableTask } from '@anthropic/agent'
import { listTasks, claimTask, updateTask } from '../../tasks.js'

export interface SwarmTaskClaimingConfig {
  /** 团队名称（用于确定任务列表 ID） */
  teamName: string
}

/**
 * 创建队友的 TaskClaimingDep 实现
 *
 * 包装 src/ 的文件任务系统为 AgentCore 的 TaskClaimingDep 接口
 */
export function createSwarmTaskClaimingAdapter(config: SwarmTaskClaimingConfig): TaskClaimingDep {
  return {
    async listAvailable(): Promise<ClaimableTask[]> {
      const tasks = await listTasks(config.teamName)
      return tasks
        .filter(t => t.status === 'pending')
        .map(t => ({
          taskId: t.id,
          description: t.subject,
          priority: t.priority,
        }))
    },

    async claim(taskId: string): Promise<boolean> {
      // claimTask 需要 agentName，这里用 teamName 作为上下文
      const result = await claimTask(config.teamName, taskId, config.teamName)
      return result.success
    },

    async update(taskId: string, status: string): Promise<void> {
      await updateTask(config.teamName, taskId, { status: status as 'pending' | 'in_progress' | 'completed' })
    },
  }
}
