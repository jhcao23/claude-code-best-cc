// hostDepsImpl — SwarmHostDeps 的 src/ 具体实现
// 桥接 src/ 基础设施到 packages/swarm 的 SwarmHostDeps 接口
// 用于未来 SwarmOrchestrator 和高级编排层

import type {
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
  HostTaskSystem,
  HostUIState,
  HostWorktreeManager,
  HostEnvironment,
  HostTask,
} from '@anthropic/swarm'
import { getSessionId } from '../../bootstrap/state.js'
import type { ToolUseContext } from '../../Tool.js'
import { streamAssistantResponse } from '../../services/api/claude.js'
import { getTeamsDir } from '../envUtils.js'
import { feature } from 'bun:bundle'
import { existsSync } from 'fs'
import { mkdir, readFile as fsReadFile, readdir, rm, writeFile as fsWriteFile } from 'fs/promises'
import { getAgentName, getTeamName } from '../teammate.js'
import { listTasks, claimTask, updateTask } from '../tasks.js'

/**
 * 创建 HostFileSystem 实现
 * 直接代理 Node.js fs 模块
 */
function createHostFileSystem(): HostFileSystem {
  return {
    readFile: (path: string) => fsReadFile(path, 'utf-8'),
    writeFile: fsWriteFile,
    mkdir: (path, options) => mkdir(path, options),
    exists: (path) => Promise.resolve(existsSync(path)),
    rm,
    readdir: (path) => readdir(path) as Promise<string[]>,
  }
}

/**
 * 创建 HostSessionManager 实现
 */
function createHostSessionManager(): HostSessionManager {
  return {
    async recordTranscript(_messages: unknown[]): Promise<void> {
      // 转录记录由各模块自行处理
    },
    getSessionId(): string {
      return getSessionId()
    },
  }
}

/**
 * 创建 HostEnvironment 实现
 */
function createHostEnvironment(): HostEnvironment {
  return {
    getTeamsDir(): string {
      return getTeamsDir()
    },
    getTeamName(): string | undefined {
      return getTeamName()
    },
    getAgentName(): string | undefined {
      return getAgentName()
    },
    getAgentColor(): string | undefined {
      return undefined
    },
    getSessionId(): string {
      return getSessionId()
    },
    isEnabled(flag: string): boolean {
      return feature(flag)
    },
  }
}

/**
 * 创建 HostTaskSystem 实现
 */
function createHostTaskSystem(): HostTaskSystem {
  return {
    async listTasks(listId: string): Promise<HostTask[]> {
      const tasks = await listTasks(listId)
      return tasks.map(t => ({
        id: t.id,
        subject: t.subject,
        description: t.description,
        status: t.status,
        owner: t.owner,
        blockedBy: t.blockedBy,
      }))
    },

    async claimTask(listId: string, taskId: string, agentName: string): Promise<{ success: boolean; reason?: string }> {
      return claimTask(listId, taskId, agentName)
    },

    async updateTask(listId: string, taskId: string, updates: Partial<HostTask>): Promise<void> {
      await updateTask(listId, taskId, updates as never)
    },
  }
}

/**
 * 创建 SwarmHostDeps 的完整实现
 *
 * @param context - ToolUseContext 或其子集，提供运行时状态
 * @returns 完整的 SwarmHostDeps 对象
 */
export function createSwarmHostDeps(
  context?: Partial<ToolUseContext>,
): SwarmHostDeps {
  return {
    api: {
      async *stream(params) {
        for await (const event of streamAssistantResponse(params as never)) {
          yield event
        }
      },
      getModel: () => 'claude-sonnet-4-6',
    } satisfies HostApiProvider,

    tools: {
      find(_name: string) {
        // TODO: 连接到 ToolRegistry
        return undefined
      },
      list() {
        // TODO: 连接到 ToolRegistry
        return []
      },
      async execute(_tool: unknown, _input: unknown, _context: unknown) {
        throw new Error('Not implemented — use SwarmToolAdapter for agent-level tool execution')
      },
    } satisfies HostToolRegistry,

    permissions: {
      async canUseTool() {
        return { allowed: true }
      },
    } satisfies HostPermissionGate,

    compaction: {
      async maybeCompact(messages: unknown[], _tokenCount: number) {
        return { compacted: false, messages: messages as never[] }
      },
    } satisfies HostCompaction,

    context: {
      getSystemPrompt: async () => [],
      getUserContext: () => ({}),
      getSystemContext: () => ({}),
    } satisfies HostContextProvider,

    session: createHostSessionManager(),

    events: {
      emit(_event: unknown) {
        // no-op by default
      },
    } satisfies HostEventSink,

    hooks: {
      async onTurnStart() {},
      async onTurnEnd() {},
      async onStop() {
        return { blockingErrors: [], preventContinuation: false }
      },
    } satisfies HostHookCallbacks,

    fs: createHostFileSystem(),

    tasks: createHostTaskSystem(),

    ui: {
      updateTask(_taskId: string, _updater: (task: unknown) => unknown) {
        // no-op by default — 需要传入 setAppState
      },
      getAppState() {
        return context?.getAppState?.() ?? null
      },
    } satisfies HostUIState,

    worktree: {
      async create() {
        throw new Error('Not implemented')
      },
      async remove() {
        throw new Error('Not implemented')
      },
      async validate() {
        return false
      },
    } satisfies HostWorktreeManager,

    env: createHostEnvironment(),
  }
}
