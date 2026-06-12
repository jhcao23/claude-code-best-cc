import { expect, test } from 'bun:test'
import { createEngineContext } from '../engine/context.js'
import { agentCallKey } from '../engine/journal.js'
import { makeHooks, type SubWorkflowRunner } from '../engine/hooks.js'
import { WorkflowError } from '../engine/errors.js'
import { createBufferingEmitter } from '../progress/events.js'
import { createHostHandle, type WorkflowPorts } from '../ports.js'
import type { AgentRunParams, AgentRunResult, JournalEntry } from '../types.js'

function buildCtx(
  overrides: Partial<{
    agentResults: Map<string, AgentRunResult>
    pending: { kind: 'skip' | 'retry' } | null
    journal: JournalEntry[]
    budgetTotal: number | null
  }> = {},
): {
  ctx: ReturnType<typeof createEngineContext>
  events: import('../types.js').ProgressEvent[]
  hooks: ReturnType<typeof makeHooks>
} {
  const { emitter, events } = createBufferingEmitter()
  const results = overrides.agentResults ?? new Map<string, AgentRunResult>()
  const ports: WorkflowPorts = {
    agentRunner: {
      runAgentToResult: async (params: AgentRunParams) =>
        results.get(params.prompt) ?? { kind: 'dead' },
    },
    progressEmitter: emitter,
    taskRegistrar: {
      register: () => ({ runId: 'r', signal: new AbortController().signal }),
      complete: () => {},
      fail: () => {},
      kill: () => {},
      pendingAction: () => overrides.pending ?? null,
    },
    journalStore: {
      read: async () => [],
      append: async () => {},
      truncate: async () => {},
    },
    permissionGate: { isAborted: () => false },
    logger: { debug: () => {}, event: () => {} },
    hostFactory: () => ({
      handle: createHostHandle(null),
      cwd: '/tmp',
      budgetTotal: null,
    }),
  }
  const ctx = createEngineContext({
    ports,
    host: createHostHandle(null),
    signal: new AbortController().signal,
    runId: 'r1',
    workflowName: 'w',
    cwd: '/tmp',
    budgetTotal: overrides.budgetTotal ?? null,
    journal: overrides.journal,
  })
  const noopSub: SubWorkflowRunner = async () => null
  return { ctx, events, hooks: makeHooks(ctx, noopSub) }
}

test('agent 返回文本结果并计数', async () => {
  const { ctx, hooks } = buildCtx({
    agentResults: new Map([
      ['hi', { kind: 'ok', output: 'hello', usage: { outputTokens: 5 } }],
    ]),
  })
  const out = await hooks.agent('hi')
  expect(out).toBe('hello')
  expect(ctx.resources.agentCountBox.value).toBe(1)
})

test('agent skipped → null 且不计数', async () => {
  const { hooks } = buildCtx({
    agentResults: new Map([['hi', { kind: 'skipped' }]]),
  })
  expect(await hooks.agent('hi')).toBeNull()
})

test('agent dead → null', async () => {
  const { hooks } = buildCtx({
    agentResults: new Map([['hi', { kind: 'dead' }]]),
  })
  expect(await hooks.agent('hi')).toBeNull()
})

test('agent journal 命中时不调用 runner', async () => {
  let called = 0
  const { emitter } = createBufferingEmitter()
  const ports: WorkflowPorts = {
    agentRunner: {
      runAgentToResult: async () => {
        called++
        return { kind: 'ok', output: 'live', usage: { outputTokens: 1 } }
      },
    },
    progressEmitter: emitter,
    taskRegistrar: {
      register: () => ({ runId: 'r', signal: new AbortController().signal }),
      complete: () => {},
      fail: () => {},
      kill: () => {},
      pendingAction: () => null,
    },
    journalStore: {
      read: async () => [],
      append: async () => {},
      truncate: async () => {},
    },
    permissionGate: { isAborted: () => false },
    logger: { debug: () => {}, event: () => {} },
    hostFactory: () => ({
      handle: createHostHandle(null),
      cwd: '/tmp',
      budgetTotal: null,
    }),
  }
  const key = agentCallKey('hi', { prompt: 'hi' })
  const ctx = createEngineContext({
    ports,
    host: createHostHandle(null),
    signal: new AbortController().signal,
    runId: 'r1',
    workflowName: 'w',
    cwd: '/tmp',
    budgetTotal: null,
    journal: [
      {
        key,
        result: { kind: 'ok', output: 'cached', usage: { outputTokens: 1 } },
      },
    ],
  })
  const hooks = makeHooks(ctx, async () => null)
  expect(await hooks.agent('hi')).toBe('cached')
  expect(called).toBe(0)
})

test('agent 超过总数上限抛错', async () => {
  const { hooks, ctx } = buildCtx()
  ctx.resources.agentCountBox.value = 1000
  await expect(hooks.agent('hi')).rejects.toThrow(WorkflowError)
})

test('parallel 单项抛错 → null，其余保留', async () => {
  const { hooks } = buildCtx()
  const out = await hooks.parallel([
    async () => 'a',
    async () => {
      throw new Error('x')
    },
    async () => 'c',
  ])
  expect(out).toEqual(['a', null, 'c'])
})

test('pipeline 逐 stage 链式，stage 抛错 → null', async () => {
  const { hooks } = buildCtx()
  const out = await hooks.pipeline(
    [1, 2],
    n => Promise.resolve((n as number) + 1),
    m => Promise.resolve((m as number) * 10),
  )
  expect(out).toEqual([20, 30])
  const out2 = await hooks.pipeline(
    [1],
    () => Promise.reject(new Error('boom')),
    m => Promise.resolve(m),
  )
  expect(out2).toEqual([null])
})

test('pipeline 超 4096 抛错', async () => {
  const { hooks } = buildCtx()
  await expect(
    hooks.pipeline(Array(4097), () => Promise.resolve(1)),
  ).rejects.toThrow(WorkflowError)
})

test('phase 切换发射 phase_started/done；log 发射 log', () => {
  const { hooks, events } = buildCtx()
  hooks.phase('A')
  hooks.log('hello')
  hooks.phase('B')
  expect(events.some(e => e.type === 'phase_started' && e.phase === 'A')).toBe(
    true,
  )
  expect(events.some(e => e.type === 'phase_done' && e.phase === 'A')).toBe(
    true,
  )
  expect(events.some(e => e.type === 'log' && e.message === 'hello')).toBe(true)
  expect(events.some(e => e.type === 'phase_started' && e.phase === 'B')).toBe(
    true,
  )
})
