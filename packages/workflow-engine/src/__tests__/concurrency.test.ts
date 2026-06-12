import { expect, test } from 'bun:test'
import { Semaphore, maxConcurrency } from '../engine/concurrency.js'

test('Semaphore 限制并发，permit 转移不泄漏', async () => {
  const sem = new Semaphore(2)
  let active = 0
  let peak = 0
  const task = async (): Promise<void> => {
    const release = await sem.acquire()
    active++
    peak = Math.max(peak, active)
    await new Promise(r => {
      setTimeout(r, 10)
    })
    active--
    release()
  }
  await Promise.all(Array.from({ length: 6 }, () => task()))
  expect(peak).toBe(2) // 永不超过 permits
})

test('maxConcurrency 落在 [1, 16]', () => {
  const n = maxConcurrency()
  expect(n).toBeGreaterThanOrEqual(1)
  expect(n).toBeLessThanOrEqual(16)
})
