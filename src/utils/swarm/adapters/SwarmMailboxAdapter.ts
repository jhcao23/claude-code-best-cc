// SwarmMailboxAdapter — 桥接 src/ 文件邮箱系统到 AgentCore 的 MailboxDep
// 使用 @anthropic/swarm 的 mailbox 功能 + src/ 的 teammateMailbox

import type { MailboxDep, IncomingMailMessage, OutgoingMailMessage } from '@anthropic/agent'
import {
  readMailbox,
  writeToMailbox,
  markMessageAsReadByIndex,
  isShutdownRequest,
  isPermissionResponse,
} from '../../teammateMailbox.js'
import { getTeamsDir } from '../../envUtils.js'
import { join } from 'path'

export interface SwarmMailboxConfig {
  /** 队友名称 */
  agentName: string
  /** 团队名称 */
  teamName: string
  /** abort signal */
  abortSignal?: AbortSignal
}

/**
 * 创建队友的 MailboxDep 实现
 *
 * 包装 src/ 的文件邮箱读写操作为 AgentCore 的 MailboxDep 接口
 */
export function createSwarmMailboxAdapter(config: SwarmMailboxConfig): MailboxDep {
  return {
    async poll(): Promise<IncomingMailMessage[]> {
      const messages = await readMailbox(config.agentName, config.teamName)
      const result: IncomingMailMessage[] = []

      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i]
        // 跳过已读消息
        if (msg.read) continue

        // 检查 shutdown 请求
        if (isShutdownRequest(msg as never)) {
          // shutdown 由 AgentLoop 的 AgentEvent 系统处理
          result.push({
            from: (msg as never).from ?? 'leader',
            text: '__SHUTDOWN_REQUEST__',
            index: i,
          })
          continue
        }

        // 检查 permission response
        if (isPermissionResponse(msg as never)) {
          // permission response 由 SwarmPermissionAdapter 处理，不注入到消息流
          continue
        }

        result.push({
          from: msg.from,
          fromName: msg.from,
          text: msg.text,
          summary: msg.summary,
          index: i,
        })
      }

      return result
    },

    async markRead(index: number): Promise<void> {
      await markMessageAsReadByIndex(config.agentName, config.teamName, index)
    },

    async sendTo(peerId: string, message: OutgoingMailMessage): Promise<void> {
      await writeToMailbox(peerId, config.teamName, {
        from: config.agentName,
        text: message.text,
        summary: message.summary,
      })
    },

    async broadcast(message: OutgoingMailMessage): Promise<void> {
      // 广播需要读取团队文件获取所有成员
      try {
        const teamDir = join(getTeamsDir(), config.teamName)
        const { readFile } = await import('fs/promises')
        const teamFilePath = join(teamDir, 'team.json')
        const content = await readFile(teamFilePath, 'utf-8')
        const team = JSON.parse(content)
        const members: Array<{ name: string }> = team.members ?? []

        for (const member of members) {
          if (member.name !== config.agentName) {
            await writeToMailbox(member.name, config.teamName, {
              from: config.agentName,
              text: message.text,
              summary: message.summary,
            })
          }
        }
      } catch {
        // 广播失败时静默处理
      }
    },
  }
}
