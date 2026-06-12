import { expect, test } from 'bun:test'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runWorkflow } from '../engine/runWorkflow.js'
import { agentCallKey, createFileJournalStore } from '../engine/journal.js'
import { createHostHandle, type WorkflowPorts } from '../ports.js'
import type { AgentRunParams, AgentRunResult } from '../types.js'

function portsWith(
  runsDir: string,
  results: Map<string, AgentRunResult>,
): WorkflowPorts {
  return {
    agentRunner: {
      runAgentToResult: async (p: AgentRunParams) =>
        results.get(p.prompt) ?? { kind: 'dead' },
    },
    progressEmitter: { emit: () => {} },
    taskRegistrar: {
      register: () => ({ runId: 'r', signal: new AbortController().signal }),
      complete: () => {},
      fail: () => {},
      kill: () => {},
      pendingAction: () => null,
    },
    journalStore: createFileJournalStore(runsDir),
    permissionGate: { isAborted: () => false },
    logger: { debug: () => {}, event: () => {} },
    hostFactory: () => ({
      handle: createHostHandle(null),
      cwd: runsDir,
      budgetTotal: null,
    }),
  }
}

test('端到端：脚本返回 agent 结果，状态 completed', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wf-run-'))
  try {
    const ports = portsWith(
      dir,
      new Map([
        ['compute', { kind: 'ok', output: '42', usage: { outputTokens: 3 } }],
      ]),
    )
    const result = await runWorkflow({
      script: `export const meta = { name: 't', description: 'd' }\nreturn agent('compute')`,
      runId: 'run-1',
      ports,
      host: createHostHandle(null),
      signal: new AbortController().signal,
      cwd: dir,
      budgetTotal: null,
    })
    expect(result.status).toBe('completed')
    expect(result.returnValue).toBe('42')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('脚本语法错误 → failed', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wf-run-'))
  try {
    const ports = portsWith(dir, new Map())
    const result = await runWorkflow({
      script: `export const meta = { name: 't', description: 'd' }\nreturn ((`,
      runId: 'run-2',
      ports,
      host: createHostHandle(null),
      signal: new AbortController().signal,
      cwd: dir,
      budgetTotal: null,
    })
    expect(result.status).toBe('failed')
    expect(result.error).toBeTruthy()
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('resume：journal 命中则不调用 runner', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wf-run-'))
  try {
    let called = 0
    const ports: WorkflowPorts = {
      agentRunner: {
        runAgentToResult: async () => {
          called++
          return { kind: 'ok', output: 'live', usage: { outputTokens: 1 } }
        },
      },
      progressEmitter: { emit: () => {} },
      taskRegistrar: {
        register: () => ({ runId: 'r', signal: new AbortController().signal }),
        complete: () => {},
        fail: () => {},
        kill: () => {},
        pendingAction: () => null,
      },
      journalStore: createFileJournalStore(dir),
      permissionGate: { isAborted: () => false },
      logger: { debug: () => {}, event: () => {} },
      hostFactory: () => ({
        handle: createHostHandle(null),
        cwd: dir,
        budgetTotal: null,
      }),
    }
    const key = agentCallKey('compute', { prompt: 'compute' })
    await ports.journalStore.append('run-3', {
      key,
      result: { kind: 'ok', output: 'cached', usage: { outputTokens: 1 } },
    })

    const result = await runWorkflow({
      script: `return agent('compute')`,
      runId: 'run-3',
      ports,
      host: createHostHandle(null),
      signal: new AbortController().signal,
      cwd: dir,
      budgetTotal: null,
      resume: true,
    })
    expect(result.status).toBe('completed')
    expect(result.returnValue).toBe('cached')
    expect(called).toBe(0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('abort → killed', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wf-run-'))
  try {
    const ports = portsWith(
      dir,
      new Map([['x', { kind: 'ok', output: '1', usage: { outputTokens: 1 } }]]),
    )
    const ac = new AbortController()
    ac.abort()
    const result = await runWorkflow({
      script: `return agent('x')`,
      runId: 'run-4',
      ports,
      host: createHostHandle(null),
      signal: ac.signal,
      cwd: dir,
      budgetTotal: null,
    })
    expect(result.status).toBe('killed')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('workflow() 嵌套（一层）共享计数', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wf-run-'))
  try {
    await mkdir(join(dir, '.claude', 'workflows'), { recursive: true })
    await writeFile(
      join(dir, '.claude', 'workflows', 'child.ts'),
      `return agent('child')\n// child workflow`,
    )
    const ports = portsWith(
      dir,
      new Map([
        [
          'child',
          { kind: 'ok', output: 'child-out', usage: { outputTokens: 1 } },
        ],
      ]),
    )
    const result = await runWorkflow({
      script: `return workflow('child')`,
      runId: 'run-5',
      ports,
      host: createHostHandle(null),
      signal: new AbortController().signal,
      cwd: dir,
      budgetTotal: null,
    })
    expect(result.status).toBe('completed')
    expect(result.returnValue).toBe('child-out')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
