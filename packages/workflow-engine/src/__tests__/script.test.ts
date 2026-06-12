import { expect, test } from 'bun:test'
import {
  ScriptError,
  extractMeta,
  parseScript,
  type WorkflowHooks,
} from '../engine/script.js'

const stubHooks: WorkflowHooks = {
  agent: async () => 'agent-result',
  parallel: async thunks =>
    Promise.all(
      thunks.map(async t => {
        try {
          return await t()
        } catch {
          return null
        }
      }),
    ),
  pipeline: async () => [],
  phase: () => {},
  log: () => {},
  workflow: async () => null,
}

test('extractMeta 提取纯字面量并剥离语句', () => {
  const src = `export const meta = { name: 'x', description: 'y' }\nreturn 1`
  const { meta, body } = extractMeta(src)
  expect(meta?.name).toBe('x')
  expect(meta?.description).toBe('y')
  expect(body).not.toContain('export const meta')
  expect(body).toContain('return 1')
})

test('extractMeta 无 meta 返回 null 且 body 不变', () => {
  const src = `return 42`
  const { meta, body } = extractMeta(src)
  expect(meta).toBeNull()
  expect(body).toBe(src)
})

test('extractMeta 拒绝非纯字面量（引用变量）', () => {
  const src = `const x = 1\nexport const meta = { name: 'x', description: y }\nreturn 1`
  expect(() => extractMeta(src)).toThrow(ScriptError)
})

test('parseScript 执行 body 顶层 return', async () => {
  const { execute } = parseScript(`return args.n + 1`)
  const out = await execute(stubHooks, { n: 41 }, { total: null })
  expect(out).toBe(42)
})

test('脚本中 Date.now() 抛非确定性错误', async () => {
  const { execute } = parseScript(`return Date.now()`)
  await expect(execute(stubHooks, {}, { total: null })).rejects.toThrow(
    /Date\.now/,
  )
})

test('脚本中 Math.random() 抛非确定性错误', async () => {
  const { execute } = parseScript(`return Math.random()`)
  await expect(execute(stubHooks, {}, { total: null })).rejects.toThrow(
    /Math\.random/,
  )
})

test('无参 new Date() 抛，有参 new Date() 可用', async () => {
  const bad = parseScript(`return new Date()`)
  await expect(bad.execute(stubHooks, {}, { total: null })).rejects.toThrow(
    /new Date/,
  )
  const good = parseScript(
    `return new Date('2020-06-12T00:00:00Z').getUTCFullYear()`,
  )
  await expect(good.execute(stubHooks, {}, { total: null })).resolves.toBe(2020)
})
