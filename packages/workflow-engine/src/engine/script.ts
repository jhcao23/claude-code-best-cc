import type { WorkflowMeta } from '../types.js'

export class ScriptError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScriptError'
  }
}

/** 引擎注入脚本的钩子函数形状。 */
export type WorkflowHooks = {
  agent: (prompt: string, opts?: Record<string, unknown>) => Promise<unknown>
  parallel: <T>(thunks: Array<() => Promise<T>>) => Promise<Array<T | null>>
  pipeline: <T, R>(
    items: readonly T[],
    ...stages: Array<
      (prev: unknown, item: T, index: number) => Promise<unknown>
    >
  ) => Promise<Array<R | null>>
  phase: (title: string) => void
  log: (message: string) => void
  workflow: (
    nameOrRef: string | { scriptPath: string },
    args?: unknown,
  ) => Promise<unknown>
}

const META_RE = /export\s+const\s+meta\s*=\s*/

/**
 * 提取 `export const meta = { ... }` 纯字面量。返回 meta 对象与剥离后的 body。
 * 字面量用无参 Function 求值——任何标识符引用都会抛 ReferenceError → 报「非纯字面量」。
 */
export function extractMeta(source: string): {
  meta: WorkflowMeta | null
  body: string
} {
  const match = META_RE.exec(source)
  if (!match) return { meta: null, body: source }

  let i = match.index + match[0].length
  while (i < source.length && /\s/.test(source[i]!)) i++
  if (source[i] !== '{') {
    throw new ScriptError('meta 必须是对象字面量 `{ ... }`')
  }

  // 大括号匹配（处理字符串/转义/嵌套）
  let depth = 0
  const start = i
  let inStr: string | null = null
  for (; i < source.length; i++) {
    const ch = source[i]!
    if (inStr) {
      if (ch === '\\') {
        i++
        continue
      }
      if (ch === inStr) inStr = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        i++
        break
      }
    }
  }
  if (depth !== 0) throw new ScriptError('meta 字面量大括号未闭合')

  const literal = source.slice(start, i)
  let metaObj: unknown
  try {
    // 无参 Function：纯字面量可求值；引用任何标识符 → ReferenceError
    metaObj = new Function(`return (${literal})`)()
  } catch (e) {
    throw new ScriptError(
      `meta 必须是纯字面量（无变量/函数调用/插值）：${(e as Error).message}`,
    )
  }
  const meta = validateMeta(metaObj)

  // 剥离 meta 语句（含尾随分号与多余空行）
  const body = (source.slice(0, match.index) + source.slice(i)).replace(
    /[ \t]*;[ \t]*\n/,
    '\n',
  )
  return { meta, body }
}

function validateMeta(v: unknown): WorkflowMeta {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw new ScriptError('meta 必须是对象')
  }
  const o = v as Record<string, unknown>
  if (typeof o.name !== 'string' || typeof o.description !== 'string') {
    throw new ScriptError('meta 必须含字符串 name 与 description')
  }
  return o as unknown as WorkflowMeta
}

// ---- 非确定性沙箱 shim ----
class NonDeterministicError extends Error {
  constructor(fn: string) {
    super(
      `${fn} 在 workflow 脚本中不可用（会破坏 resume 的确定性）。请通过 args 传入时间戳/随机种子。`,
    )
    this.name = 'NonDeterministicError'
  }
}

function sandboxDate(): DateConstructor {
  const fn = function (...args: unknown[]): Date {
    if (args.length === 0)
      throw new NonDeterministicError('Date.now()/new Date()')
    return new (Date as unknown as DateConstructor)(
      ...(args as [string | number | Date]),
    )
  } as unknown as DateConstructor
  fn.now = () => {
    throw new NonDeterministicError('Date.now()')
  }
  fn.parse = Date.parse
  fn.UTC = Date.UTC
  return fn
}

function sandboxMath(): Math {
  return new Proxy(Math, {
    get(target, prop, receiver) {
      if (prop === 'random') {
        return () => {
          throw new NonDeterministicError('Math.random()')
        }
      }
      return Reflect.get(target, prop, receiver)
    },
  }) as Math
}

const AsyncFunction = Object.getPrototypeOf(async function () {})
  .constructor as {
  new (...args: string[]): (...args: unknown[]) => Promise<unknown>
}

export type ParsedScript = {
  meta: WorkflowMeta | null
  execute: (
    hooks: WorkflowHooks,
    args: unknown,
    budget: unknown,
  ) => Promise<unknown>
}

/** 校验 + 包装脚本为可执行 async 函数（Date/Math 被 shim 覆盖）。 */
export function parseScript(source: string): ParsedScript {
  const { meta, body } = extractMeta(source)
  let fn: (...args: unknown[]) => Promise<unknown>
  try {
    fn = new AsyncFunction(
      'agent',
      'parallel',
      'pipeline',
      'phase',
      'log',
      'workflow',
      'args',
      'budget',
      'Date',
      'Math',
      body,
    )
  } catch (e) {
    throw new ScriptError(`脚本语法错误：${(e as Error).message}`)
  }
  const sandboxedDate = sandboxDate()
  const sandboxedMath = sandboxMath()
  return {
    meta,
    async execute(hooks, args, budget) {
      return fn(
        hooks.agent,
        hooks.parallel,
        hooks.pipeline,
        hooks.phase,
        hooks.log,
        hooks.workflow,
        args,
        budget,
        sandboxedDate,
        sandboxedMath,
      )
    },
  }
}
