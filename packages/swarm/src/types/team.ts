// Swarm 队友身份 & 消息类型 — 零外部依赖

import type { BackendType } from './backends.js'

// --- 队友身份 ---

export interface TeammateIdentity {
  agentId: string
  agentName: string
  parentSessionId: string
  teamName: string
  color?: string
  planModeRequired?: boolean
}

// --- 邮箱消息 ---

export interface TeammateMessage {
  from: string
  text: string
  timestamp: string
  read: boolean
  color?: string
  summary?: string
}

// --- 空闲通知 ---

export interface IdleNotification {
  type: 'idle'
  agentName: string
  idleReason: 'available' | 'interrupted' | 'failed'
  summary?: string
  completedTaskId?: string
  completedStatus?: 'resolved' | 'blocked' | 'failed'
  failureReason?: string
}

// --- 关闭请求 ---

export interface ShutdownRequest {
  type: 'shutdown_request'
  from: string
  reason?: string
}

// --- 权限请求 ---

export interface PermissionRequest {
  id: string
  toolName: string
  toolUseId: string
  input: unknown
  description: string
  permissionSuggestions?: unknown
  workerId: string
  workerName: string
  workerColor?: string
  teamName: string
  timestamp: string
}

// --- 权限响应 ---

export interface PermissionResponse {
  type: 'permission_response'
  requestId: string
  decision: 'allow' | 'deny'
  updatedInput?: Record<string, unknown>
  permissionUpdates?: unknown[]
  feedback?: string
  contentBlocks?: unknown[]
}

// --- 后端类型 ---
// BackendType 从 backends.ts 导入，不再在此处定义

export interface TeammateSpawnConfig {
  agentName: string
  teamName: string
  prompt: string
  model?: string
  systemPrompt?: string
  systemPromptMode?: 'default' | 'replace' | 'append'
  allowedTools?: string[]
  allowPermissionPrompts?: boolean
  description?: string
  color?: string
}

export interface TeammateSpawnResult {
  success: boolean
  error?: string
  agentId?: string
}

// --- 团队文件结构 ---

export interface TeamFile {
  name: string
  members: TeamMember[]
  createdAt: string
  permissionMode: string
}

export interface TeamMember {
  agentId: string
  agentName: string
  color?: string
  backend: BackendType
  status: 'running' | 'idle' | 'stopped'
  joinedAt: string
}

// --- 任务类型 ---

export interface SwarmTask {
  id: string
  subject: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed'
  owner?: string
  blockedBy: string[]
  priority?: number
}
