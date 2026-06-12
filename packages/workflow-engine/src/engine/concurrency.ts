import * as os from 'node:os'
import { MAX_CONCURRENCY_CAP, MAX_CONCURRENCY_OFFSET } from '../constants.js'

/**
 * 异步信号量。acquire() 返回一个 release 函数；permit 在 release 时直接
 * 转移给下一个等待者（available 不变），无等待者时才归还。permit 总数守恒。
 */
export class Semaphore {
  private available: number
  private readonly waiters: Array<() => void> = []

  constructor(permits: number) {
    this.available = Math.max(1, Math.floor(permits))
  }

  async acquire(): Promise<() => void> {
    if (this.available > 0) {
      this.available -= 1
      return () => this.release()
    }
    await new Promise<void>(resolve => {
      this.waiters.push(resolve)
    })
    // 被唤醒 = 一个 permit 已转移给我，不再扣减
    return () => this.release()
  }

  private release(): void {
    const next = this.waiters.shift()
    if (next) {
      next() // 直接转移 permit
    } else {
      this.available += 1
    }
  }
}

function cpuCores(): number {
  const a = (os as { availableParallelism?: () => number }).availableParallelism
  if (typeof a === 'function') {
    try {
      return a()
    } catch {
      // fallthrough
    }
  }
  return os.cpus()?.length ?? 4
}

/** min(MAX_CONCURRENCY_CAP, cpuCores - MAX_CONCURRENCY_OFFSET)，至少 1。 */
export function maxConcurrency(): number {
  return Math.max(
    1,
    Math.min(MAX_CONCURRENCY_CAP, cpuCores() - MAX_CONCURRENCY_OFFSET),
  )
}
