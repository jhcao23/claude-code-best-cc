import type { Command, LocalCommandCall } from '../../types/command.js'
import { getWorkflowCommands } from '../../workflow/namedWorkflowCommands.js'
import { listRunProgresses } from '../../workflow/progressStore.js'
import { getCwd } from '../../utils/cwd.js'

const call: LocalCommandCall = async _args => {
  const commands = await getWorkflowCommands(getCwd())
  const runs = listRunProgresses()

  const lines: string[] = []
  if (runs.length > 0) {
    lines.push('Workflow runs (live):')
    for (const r of runs.slice(0, 20)) {
      lines.push(
        `  ${r.runId} | ${r.workflowName} | ${r.status} | phase=${r.currentPhase ?? '-'} | agents=${r.agentCount}`,
      )
    }
    lines.push('')
  }
  if (commands.length === 0) {
    lines.push(
      'No named workflows. Add scripts to .claude/workflows/ (*.ts/*.js/*.mjs).',
    )
  } else {
    lines.push('Named workflows:')
    for (const cmd of commands)
      lines.push(`  /${cmd.name} - ${cmd.description}`)
  }
  return { type: 'text', value: lines.join('\n') }
}

const workflows = {
  type: 'local',
  name: 'workflows',
  description: 'List workflow runs (live progress) and named workflows',
  supportsNonInteractive: true,
  load: () => Promise.resolve({ call }),
} satisfies Command

export default workflows
