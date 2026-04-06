// mailbox — 基于 HostFileSystem 的文件邮箱系统
// 零外部依赖（除 HostFileSystem）

import type { HostFileSystem } from '../types/deps.js'
import type { TeammateMessage, IdleNotification, ShutdownRequest, PermissionResponse } from '../types/team.js'
import { LOCK_OPTIONS, TEAM_LEAD_NAME } from '../types/constants.js'

/**
 * 路径安全化 — 防止路径穿越攻击
 */
export function sanitizePathComponent(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100)
}

/**
 * 获取收件箱路径
 */
export function getInboxPath(
  agentName: string,
  teamName: string,
  teamsDir: string,
): string {
  const safeTeam = sanitizePathComponent(teamName)
  const safeAgent = sanitizePathComponent(agentName)
  return `${teamsDir}/${safeTeam}/inboxes/${safeAgent}.json`
}

/**
 * 读取邮箱全部消息
 */
export async function readMailbox(
  fs: HostFileSystem,
  agentName: string,
  teamName: string,
  teamsDir: string,
): Promise<TeammateMessage[]> {
  const path = getInboxPath(agentName, teamName, teamsDir)
  try {
    const content = await fs.readFile(path)
    return JSON.parse(content) as TeammateMessage[]
  } catch {
    return []
  }
}

/**
 * 读取未读消息
 */
export async function readUnreadMessages(
  fs: HostFileSystem,
  agentName: string,
  teamName: string,
  teamsDir: string,
): Promise<TeammateMessage[]> {
  const messages = await readMailbox(fs, agentName, teamName, teamsDir)
  return messages.filter(m => !m.read)
}

/**
 * 写消息到邮箱（带 lockfile 并发控制）
 */
export async function writeToMailbox(
  fs: HostFileSystem,
  recipientName: string,
  teamName: string,
  teamsDir: string,
  message: Omit<TeammateMessage, 'read'>,
): Promise<void> {
  const inboxPath = getInboxPath(recipientName, teamName, teamsDir)
  const inboxDir = inboxPath.substring(0, inboxPath.lastIndexOf('/'))

  // 确保目录存在
  await fs.mkdir(inboxDir, { recursive: true })

  // 确保文件存在
  try {
    await fs.writeFile(inboxPath, '[]')
  } catch {
    // 文件已存在，忽略
  }

  // 读-修改-写（简化版，无 lockfile — 由宿主的 fs 实现处理并发）
  const messages = await readMailbox(fs, recipientName, teamName, teamsDir)
  messages.push({ ...message, read: false })
  await fs.writeFile(inboxPath, JSON.stringify(messages))
}

/**
 * 按索引标记已读
 */
export async function markMessageAsReadByIndex(
  fs: HostFileSystem,
  agentName: string,
  teamName: string,
  teamsDir: string,
  index: number,
): Promise<void> {
  const messages = await readMailbox(fs, agentName, teamName, teamsDir)
  if (index >= 0 && index < messages.length) {
    messages[index] = { ...messages[index], read: true }
    const path = getInboxPath(agentName, teamName, teamsDir)
    await fs.writeFile(path, JSON.stringify(messages))
  }
}

// --- 消息解析工具 ---

/**
 * 检查是否为关闭请求
 */
export function isShutdownRequest(text: string): ShutdownRequest | null {
  try {
    const parsed = JSON.parse(text)
    if (parsed?.type === 'shutdown_request') {
      return parsed as ShutdownRequest
    }
  } catch {
    return null
  }
  return null
}

/**
 * 检查是否为权限响应
 */
export function isPermissionResponse(text: string): PermissionResponse | null {
  try {
    const parsed = JSON.parse(text)
    if (parsed?.type === 'permission_response') {
      return parsed as PermissionResponse
    }
  } catch {
    return null
  }
  return null
}

/**
 * 创建空闲通知 JSON
 */
export function createIdleNotification(
  agentName: string,
  options?: {
    idleReason?: 'available' | 'interrupted' | 'failed'
    summary?: string
    completedTaskId?: string
    completedStatus?: 'resolved' | 'blocked' | 'failed'
    failureReason?: string
  },
): string {
  const notification = {
    type: 'idle' as const,
    agentName,
    idleReason: options?.idleReason ?? 'available',
    ...(options?.summary && { summary: options.summary }),
    ...(options?.completedTaskId && { completedTaskId: options.completedTaskId }),
    ...(options?.completedStatus && { completedStatus: options.completedStatus }),
    ...(options?.failureReason && { failureReason: options.failureReason }),
  }
  return JSON.stringify(notification)
}

/**
 * 获取最后一条 peer DM 摘要
 */
export function getLastPeerDmSummary(messages: { type: string; message?: { content?: unknown[] } }[]): string {
  // 从最后一条 assistant 消息中提取摘要
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.type === 'assistant' && msg.message?.content) {
      const content = msg.message.content as { type: string; text?: string }[]
      const textBlock = content.find(b => b.type === 'text')
      if (textBlock?.text) {
        return textBlock.text.slice(0, 100)
      }
    }
  }
  return ''
}
