import { expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  listNamedWorkflows,
  resolveNamedWorkflow,
} from '../engine/namedWorkflows.js'

test('按扩展名优先级解析命名 workflow', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wf-named-'))
  try {
    await writeFile(
      join(dir, 'a.ts'),
      'export const meta = { name: "a", description: "d" }\nreturn 1',
    )
    await writeFile(join(dir, 'b.js'), 'return 2')
    await writeFile(join(dir, 'c.mjs'), 'return 3')
    await writeFile(join(dir, 'ignore.md'), '# not a workflow')

    const a = await resolveNamedWorkflow(dir, 'a')
    expect(a?.path.endsWith('a.ts')).toBe(true)
    expect(a?.content).toContain('meta')

    expect(await resolveNamedWorkflow(dir, 'missing')).toBeNull()

    const names = await listNamedWorkflows(dir)
    expect(names).toEqual(['a', 'b', 'c']) // 不含 .md
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('listNamedWorkflows 不存在目录返回空数组', async () => {
  expect(
    await listNamedWorkflows(join(tmpdir(), 'wf-nope-' + Date.now())),
  ).toEqual([])
})
