import type { ProgressEvent } from '@claude-code-best/workflow-engine'

export type AgentProgress = {
  label?: string
  phase?: string
  status: 'running' | 'done'
  resultKind?: string
}

export type RunProgress = {
  runId: string
  workflowName: string
  status: 'running' | 'completed' | 'failed' | 'killed'
  phases: Array<{ title: string; status: 'running' | 'done' }>
  currentPhase: string | null
  agents: AgentProgress[]
  logs: string[]
  agentCount: number
  returnValue?: unknown
  error?: string
  updatedAt: number
}

const store = new Map<string, RunProgress>()

export function getRunProgress(runId: string): RunProgress | undefined {
  return store.get(runId)
}

export function listRunProgresses(): RunProgress[] {
  return [...store.values()].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function removeRunProgress(runId: string): void {
  store.delete(runId)
}

function ensure(runId: string, workflowName: string): RunProgress {
  let p = store.get(runId)
  if (!p) {
    p = {
      runId,
      workflowName,
      status: 'running',
      phases: [],
      currentPhase: null,
      agents: [],
      logs: [],
      agentCount: 0,
      updatedAt: Date.now(),
    }
    store.set(runId, p)
  }
  return p
}

/** 把引擎进度事件应用到 store。 */
export function applyProgressEvent(event: ProgressEvent): void {
  const runId = event.runId
  const p = ensure(
    runId,
    'workflowName' in event ? event.workflowName : 'workflow',
  )
  p.updatedAt = Date.now()

  switch (event.type) {
    case 'run_started':
      p.workflowName = event.workflowName
      p.status = 'running'
      break
    case 'phase_done':
      for (const ph of p.phases) {
        if (ph.title === event.phase) ph.status = 'done'
      }
      if (p.currentPhase === event.phase) p.currentPhase = null
      break
    case 'phase_started':
      if (!p.phases.some(ph => ph.title === event.phase)) {
        p.phases.push({ title: event.phase, status: 'running' })
      }
      p.currentPhase = event.phase
      break
    case 'agent_started':
      p.agents.push({
        label: event.label,
        phase: event.phase,
        status: 'running',
      })
      p.agentCount++
      break
    case 'agent_done':
      for (let i = p.agents.length - 1; i >= 0; i--) {
        if (p.agents[i]!.status === 'running') {
          p.agents[i]!.status = 'done'
          p.agents[i]!.resultKind = event.result.kind
          break
        }
      }
      break
    case 'log':
      p.logs.push(event.message)
      break
    case 'run_done':
      p.status = event.status
      if (event.returnValue !== undefined) p.returnValue = event.returnValue
      if (event.error !== undefined) p.error = event.error
      break
  }
}
