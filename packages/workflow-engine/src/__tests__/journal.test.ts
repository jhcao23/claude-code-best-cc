import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { agentCallKey, createFileJournalStore } from '../engine/journal.js'
import type { AgentRunParams } from '../types.js'

const base: AgentRunParams = { prompt: 'do something' }

test('agentCallKey 对相同 prompt+params 稳定', () => {
  expect(agentCallKey('p', base)).toBe(agentCallKey('p', base))
})

test('agentCallKey 随 prompt 变化', () => {
  expect(agentCallKey('p1', base)).not.toBe(agentCallKey('p2', base))
})

test('agentCallKey 忽略纯展示字段 label/phase', () => {
  const a = agentCallKey('p', { ...base, label: 'A', phase: 'ph1' })
  const b = agentCallKey('p', { ...base, label: 'B', phase: 'ph2' })
  expect(a).toBe(b)
})

test('FileJournalStore append → read 保序，truncate 清空', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wf-journal-'))
  try {
    const store = createFileJournalStore(dir)
    const e1 = {
      key: 'k1',
      result: { kind: 'ok' as const, output: 'x', usage: { outputTokens: 1 } },
    }
    const e2 = { key: 'k2', result: { kind: 'dead' as const } }
    await store.append('run-1', e1)
    await store.append('run-1', e2)
    const got = await store.read('run-1')
    expect(got).toHaveLength(2)
    expect(got[0]!.key).toBe('k1')
    expect(got[1]!.result.kind).toBe('dead')
    await store.truncate('run-1')
    expect(await store.read('run-1')).toEqual([])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
