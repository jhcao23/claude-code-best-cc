// permissions — 权限同步：worker → leader 请求/响应生命周期
// 零外部依赖

import type { HostFileSystem } from '../types/deps.js'
import type { PermissionRequest } from '../types/team.js'
import { sanitizePathComponent } from '../mailbox/index.js'

/**
 * 创建权限请求
 */
export function createPermissionRequest(options: {
  toolName: string
  toolUseId: string
  input: unknown
  description: string
  permissionSuggestions?: unknown
  workerId: string
  workerName: string
  workerColor?: string
  teamName: string
}): PermissionRequest {
  return {
    id: `perm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    toolName: options.toolName,
    toolUseId: options.toolUseId,
    input: options.input,
    description: options.description,
    permissionSuggestions: options.permissionSuggestions,
    workerId: options.workerId,
    workerName: options.workerName,
    workerColor: options.workerColor,
    teamName: options.teamName,
    timestamp: new Date().toISOString(),
  }
}

/**
 * 通过邮箱发送权限请求到 leader
 */
export async function sendPermissionRequestViaMailbox(
  fs: HostFileSystem,
  request: PermissionRequest,
  teamsDir: string,
): Promise<void> {
  const leaderPath = `${teamsDir}/${sanitizePathComponent(request.teamName)}/inboxes/teammate-permissions.json`
  const dir = leaderPath.substring(0, leaderPath.lastIndexOf('/'))
  await fs.mkdir(dir, { recursive: true })

  let requests: PermissionRequest[] = []
  try {
    const content = await fs.readFile(leaderPath)
    requests = JSON.parse(content)
  } catch {
    // 新文件
  }

  requests.push(request)
  await fs.writeFile(leaderPath, JSON.stringify(requests))
}

/**
 * 从邮箱读取权限请求（leader 端）
 */
export async function readPermissionRequests(
  fs: HostFileSystem,
  teamName: string,
  teamsDir: string,
): Promise<PermissionRequest[]> {
  const path = `${teamsDir}/${sanitizePathComponent(teamName)}/inboxes/teammate-permissions.json`
  try {
    const content = await fs.readFile(path)
    return JSON.parse(content)
  } catch {
    return []
  }
}

/**
 * 清除已处理的权限请求
 */
export async function clearPermissionRequest(
  fs: HostFileSystem,
  teamName: string,
  requestId: string,
  teamsDir: string,
): Promise<void> {
  const path = `${teamsDir}/${sanitizePathComponent(teamName)}/inboxes/teammate-permissions.json`
  try {
    const content = await fs.readFile(path)
    const requests: PermissionRequest[] = JSON.parse(content)
    const filtered = requests.filter(r => r.id !== requestId)
    await fs.writeFile(path, JSON.stringify(filtered))
  } catch {
    // ignore
  }
}
