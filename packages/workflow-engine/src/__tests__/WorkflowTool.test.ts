import { expect, test } from 'bun:test'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createWorkflowTool } from '../tool/WorkflowTool.js'
import { createHostHandle, type WorkflowPorts } from '../ports.js'
import type { AgentRunParams, AgentRunResult, ProgressEvent } from '../types.js'

function mockPorts(
  runsDir: string,
  results: Map<string, AgentRunResult>,
): {
  ports: WorkflowPorts
  events: ProgressEvent[]
  runStatus: Map<string, string>
} {
  const events: ProgressEvent[] = []
  const runStatus = new Map<string, string>()
  const ports: WorkflowPorts = {
    agentRunner: {
      runAgentToResult: async (p: AgentRunParams) =>
        results.get(p.prompt) ?? { kind: 'dead' },
    },
    progressEmitter: { emit: e => void events.push(e) },
    taskRegistrar: {
      register: () => ({
        runId: 'run-x',
        signal: new AbortController().signal,
      }),
      complete: id => void runStatus.set(id, 'completed'),
      fail: id => void runStatus.set(id, 'failed'),
      kill: id => void runStatus.set(id, 'killed'),
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
      cwd: runsDir,
      budgetTotal: null,
    }),
  }
  return { ports, events, runStatus }
}

test('call 返回 launch 消息并在后台完成', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wf-tool-'))
  try {
    const { ports, runStatus } = mockPorts(
      dir,
      new Map([
        ['compute', { kind: 'ok', output: '42', usage: { outputTokens: 1 } }],
      ]),
    )
    const tool = createWorkflowTool(ports)
    const res = await tool.call(
      { script: `return agent('compute')` },
      undefined,
      undefined,
      undefined,
    )
    expect(res.data.output).toContain('run_id: run-x')
    await new Promise(r => {
      setTimeout(r, 50)
    })
    expect(runStatus.get('run-x')).toBe('completed')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('缺少 script/name/scriptPath → 返回错误（不进后台）', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wf-tool-'))
  try {
    const { ports, runStatus } = mockPorts(dir, new Map())
    const tool = createWorkflowTool(ports)
    const res = await tool.call({}, undefined, undefined, undefined)
    expect(res.data.output).toMatch(/^Error:/)
    expect(runStatus.size).toBe(0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('脚本语法错 → 返回校验错误（不进后台）', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wf-tool-'))
  try {
    const { ports, runStatus } = mockPorts(dir, new Map())
    const tool = createWorkflowTool(ports)
    const res = await tool.call(
      { script: `return ((` },
      undefined,
      undefined,
      undefined,
    )
    expect(res.data.output).toMatch(/校验失败|Error/)
    expect(runStatus.size).toBe(0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('name 解析到 .claude/workflows/<name>.ts', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wf-tool-'))
  try {
    await mkdir(join(dir, '.claude', 'workflows'), { recursive: true })
    await writeFile(
      join(dir, '.claude', 'workflows', 'release.ts'),
      `return agent('compute')`,
    )
    const { ports, runStatus } = mockPorts(
      dir,
      new Map([
        ['compute', { kind: 'ok', output: 'done', usage: { outputTokens: 1 } }],
      ]),
    )
    const tool = createWorkflowTool(ports)
    const res = await tool.call(
      { name: 'release' },
      undefined,
      undefined,
      undefined,
    )
    expect(res.data.output).toContain('run_id')
    await new Promise(r => {
      setTimeout(r, 50)
    })
    expect(runStatus.get('run-x')).toBe('completed')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('renderToolUseMessage / mapToolResultToToolResultBlockParam', () => {
  const dir = '/tmp'
  const { ports } = mockPorts(dir, new Map())
  const tool = createWorkflowTool(ports)
  expect(tool.renderToolUseMessage({ name: 'release' })).toBe(
    'Workflow: release',
  )
  const block = tool.mapToolResultToToolResultBlockParam(
    { output: 'hi' },
    'tu-1',
  )
  expect(block.tool_use_id).toBe('tu-1')
  expect(block.type).toBe('tool_result')
  expect(block.content[0]!.text).toBe('hi')
})
