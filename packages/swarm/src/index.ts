// @anthropic/swarm — 多 Agent 协调功能
// 零运行时依赖（除 @anthropic/agent 用于类型）

// --- 类型导出 ---
export type {
  SwarmHostDeps,
  HostApiProvider,
  HostToolRegistry,
  HostPermissionGate,
  HostCompaction,
  HostContextProvider,
  HostSessionManager,
  HostEventSink,
  HostHookCallbacks,
  HostFileSystem,
  HostTerminalBackend,
  TerminalEnvironment,
  PaneCreateOptions,
  PaneHandle,
  HostTaskSystem,
  HostTask,
  HostUIState,
  HostWorktreeManager,
  HostEnvironment,
} from './types/deps.js'

export type {
  TeammateIdentity,
  TeammateMessage,
  IdleNotification,
  ShutdownRequest,
  PermissionRequest,
  PermissionResponse,
  TeammateSpawnConfig,
  TeammateSpawnResult,
  TeamFile,
  TeamMember,
  SwarmTask,
} from './types/team.js'

export {
  TEAM_LEAD_NAME,
  MAILBOX_POLL_INTERVAL_MS,
  PERMISSION_POLL_INTERVAL_MS,
  TEAMMATE_MESSAGES_UI_CAP,
  LOCK_OPTIONS,
  ENV,
} from './types/constants.js'

// --- 邮箱系统 ---
export {
  sanitizePathComponent,
  getInboxPath,
  readMailbox,
  readUnreadMessages,
  writeToMailbox,
  markMessageAsReadByIndex,
  isShutdownRequest,
  isPermissionResponse,
  createIdleNotification,
  getLastPeerDmSummary,
} from './mailbox/index.js'

// --- 权限同步 ---
export {
  createPermissionRequest,
  sendPermissionRequestViaMailbox,
  readPermissionRequests,
  clearPermissionRequest,
} from './permissions/index.js'

// --- 后端类型 ---
export type {
  BackendType as BackendType,
  PaneBackendType,
  PaneId,
  CreatePaneResult,
  PaneBackend,
  BackendDetectionResult,
  TeammateIdentity as BackendTeammateIdentity,
  TeammateSpawnConfig as BackendTeammateSpawnConfig,
  TeammateSpawnResult as BackendTeammateSpawnResult,
  TeammateMessage as BackendTeammateMessage,
  TeammateExecutor,
} from './types/backends.js'
export { isPaneBackend } from './types/backends.js'

// --- 核心纯逻辑 ---
export { TEAMMATE_SYSTEM_PROMPT_ADDENDUM } from './core/teammatePromptAddendum.js'
