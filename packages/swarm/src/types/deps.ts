// Swarm 包的宿主依赖接口
// src/ 提供实现，swarm 包只消费接口

import type { CoreTool, ToolResult, ToolExecContext } from '@anthropic/agent'
import type { CoreMessage } from '@anthropic/agent'

// --- 宿主提供的 API 能力 ---

export interface HostApiProvider {
  /** 流式调用 LLM */
  stream(params: {
    systemPrompt: unknown
    messages: CoreMessage[]
    tools: CoreTool[]
    model: string
    abortSignal?: AbortSignal
    [key: string]: unknown
  }): AsyncIterable<unknown>
  /** 获取当前模型 ID */
  getModel(): string
}

export interface HostToolRegistry {
  /** 按名称查找工具 */
  find(name: string): CoreTool | undefined
  /** 列出所有工具 */
  list(): CoreTool[]
  /** 执行工具 */
  execute(tool: CoreTool, input: unknown, context: ToolExecContext): Promise<ToolResult>
}

export interface HostPermissionGate {
  /** 检查是否允许使用工具 */
  canUseTool(
    tool: CoreTool,
    input: unknown,
    context: { mode: string; input: unknown; [key: string]: unknown },
  ): Promise<{ allowed: boolean; reason?: string }>
}

export interface HostCompaction {
  /** 尝试压缩消息列表 */
  maybeCompact(
    messages: CoreMessage[],
    tokenCount: number,
  ): Promise<{
    compacted: boolean
    messages: CoreMessage[]
    tokensSaved?: number
  }>
}

export interface HostContextProvider {
  /** 获取系统提示 */
  getSystemPrompt(): Promise<unknown[]>
  /** 获取用户上下文 */
  getUserContext(): Record<string, string>
  /** 获取系统上下文 */
  getSystemContext(): Record<string, string>
}

export interface HostSessionManager {
  /** 记录转录 */
  recordTranscript(messages: CoreMessage[]): Promise<void>
  /** 获取会话 ID */
  getSessionId(): string
}

export interface HostEventSink {
  /** 发射事件到输出 */
  emit(event: unknown): void
}

export interface HostHookCallbacks {
  /** Turn 开始 */
  onTurnStart(state: unknown): Promise<void>
  /** Turn 结束 */
  onTurnEnd(state: unknown): Promise<void>
  /** Stop hook */
  onStop(
    messages: CoreMessage[],
    context: { [key: string]: unknown },
  ): Promise<{
    blockingErrors: string[]
    preventContinuation: boolean
  }>
}

// --- 宿主提供的文件系统能力 ---

export interface HostFileSystem {
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>
  exists(path: string): Promise<boolean>
  rm(path: string, options?: { recursive?: boolean }): Promise<void>
  readdir(path: string): Promise<string[]>
}

// --- 宿主提供的终端能力 ---

export interface HostTerminalBackend {
  /** 检测环境 */
  detect(): Promise<TerminalEnvironment>
  /** 创建 pane */
  createPane(options: PaneCreateOptions): Promise<PaneHandle>
  /** 销毁 pane */
  destroyPane(handle: PaneHandle): Promise<void>
  /** 在 pane 中执行命令 */
  sendToPane(handle: PaneHandle, text: string): Promise<void>
  /** 隐藏/显示 pane */
  setPaneVisible(handle: PaneHandle, visible: boolean): Promise<void>
}

export type TerminalEnvironment = {
  type: 'tmux-internal' | 'tmux-external' | 'iterm2' | 'in-process' | 'none'
  hasTmux: boolean
  hasITerm2: boolean
  hasIT2: boolean
}

export type PaneCreateOptions = {
  command: string
  name?: string
  color?: string
  cwd?: string
  env?: Record<string, string>
}

export type PaneHandle = {
  id: string
  type: 'tmux' | 'iterm2'
}

// --- 宿主提供的任务系统 ---

export interface HostTaskSystem {
  /** 列出任务 */
  listTasks(listId: string): Promise<HostTask[]>
  /** 认领任务 */
  claimTask(listId: string, taskId: string, agentName: string): Promise<{ success: boolean; reason?: string }>
  /** 更新任务 */
  updateTask(listId: string, taskId: string, updates: Partial<HostTask>): Promise<void>
}

export type HostTask = {
  id: string
  subject: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed'
  owner?: string
  blockedBy: string[]
}

// --- 宿主提供的 UI 状态 ---

export interface HostUIState {
  /** 更新任务显示状态 */
  updateTask(taskId: string, updater: (task: unknown) => unknown): void
  /** 获取应用状态快照 */
  getAppState(): unknown
}

// --- 宿主提供的 Worktree 管理 ---

export interface HostWorktreeManager {
  /** 创建 worktree */
  create(options: { branch: string; path: string; slug: string }): Promise<string>
  /** 删除 worktree */
  remove(path: string): Promise<void>
  /** 验证 worktree */
  validate(path: string): Promise<boolean>
}

// --- 宿主提供的环境信息 ---

export interface HostEnvironment {
  /** 获取团队目录 */
  getTeamsDir(): string
  /** 获取当前团队名 */
  getTeamName(): string | undefined
  /** 获取当前 agent 名 */
  getAgentName(): string | undefined
  /** 获取 agent 颜色 */
  getAgentColor(): string | undefined
  /** 获取 session ID */
  getSessionId(): string
  /** 检查 feature flag */
  isEnabled(feature: string): boolean
}

// --- 汇总：宿主注入的全部依赖 ---

export interface SwarmHostDeps {
  api: HostApiProvider
  tools: HostToolRegistry
  permissions: HostPermissionGate
  compaction: HostCompaction
  context: HostContextProvider
  session: HostSessionManager
  events: HostEventSink
  hooks: HostHookCallbacks
  fs: HostFileSystem
  terminal?: HostTerminalBackend
  tasks: HostTaskSystem
  ui: HostUIState
  worktree: HostWorktreeManager
  env: HostEnvironment
}
