import type { AnimMode } from '../types'

// ─── Idle Sequence ────────────────────────────────────
// Natural-looking idle: mostly still with occasional breathe/blink/bounce/fidget
const IDLE_SEQUENCE: AnimMode[] = [
	'idle', 'idle', 'idle',
	'breathe',
	'idle', 'idle',
	'blink',
	'idle', 'idle', 'idle',
	'bounce',
	'idle', 'idle', 'idle',
	'fidget',
	'idle', 'idle',
]

export function getIdleAnimMode(tick: number): AnimMode {
	return IDLE_SEQUENCE[tick % IDLE_SEQUENCE.length]
}

// ─── Main Render ──────────────────────────────────────

export function renderAnimatedSprite(lines: string[], tick: number, mode: AnimMode): string[] {
	switch (mode) {
		case 'idle':
			return lines
		case 'breathe':
			return breathe(lines, tick)
		case 'blink':
			return blinkEyes(lines)
		case 'fidget':
			return shiftLines(lines, tick % 2 === 0 ? 0 : 1)
		case 'bounce':
			return bounce(lines, tick)
		case 'walkLeft':
			return walkLeft(lines, tick)
		case 'walkRight':
			return walkRight(lines, tick)
		case 'flip':
			return flipHorizontal(lines)
		case 'excited':
			return shiftLines(lines, tick % 2 === 0 ? -1 : 1)
		case 'pet':
			return addPetParticles(lines, tick)
		default:
			return lines
	}
}

// ─── Animation Transforms ─────────────────────────────

/** Subtle horizontal oscillation — shift right 1px on even ticks */
function breathe(lines: string[], tick: number): string[] {
	return tick % 4 < 2 ? shiftLines(lines, 1) : lines
}

/** Parabolic bounce — sprite hops up and back down */
function bounce(lines: string[], tick: number): string[] {
	const PATTERN = [0, 1, 2, 2, 1, 0, 0, 0]
	const h = PATTERN[tick % PATTERN.length]
	if (h === 0 || lines.length === 0) return lines
	return [
		...Array(h).fill(''),
		...lines.slice(0, lines.length - h),
	]
}

/** Walk left — shift left a few steps then reset */
function walkLeft(lines: string[], tick: number): string[] {
	const phase = tick % 8
	if (phase >= 4) return lines
	return shiftLines(lines, -(phase + 1))
}

/** Walk right — shift right a few steps then reset */
function walkRight(lines: string[], tick: number): string[] {
	const phase = tick % 8
	if (phase >= 4) return lines
	return shiftLines(lines, phase + 1)
}

/** Flip sprite horizontally — reverse each line's characters */
function flipHorizontal(lines: string[]): string[] {
	return lines.map(reverseLine)
}

// ─── Helpers ──────────────────────────────────────────

/** Shift all lines left (negative) or right (positive) by offset columns */
function shiftLines(lines: string[], offset: number): string[] {
	if (offset === 0) return lines
	if (offset > 0) {
		const pad = ' '.repeat(offset)
		return lines.map(line => pad + line)
	}
	const abs = Math.abs(offset)
	return lines.map(line => line.slice(abs))
}

/** Replace eye characters with blink indicator */
function blinkEyes(lines: string[]): string[] {
	return lines.map(line => line.replace(/[·✦×◉@°oO]/g, '—'))
}

/** Heart particle frames for pet animation */
const PET_HEARTS = [
	['   ♥    ', '        '],
	['  ♥ ♥   ', '   ♥    '],
	[' ♥   ♥  ', '  ♥ ♥   '],
	['  ♥ ♥   ', ' ♥   ♥  '],
	['   ♥    ', '  ♥ ♥   '],
]

/** Add heart particle frames above the sprite */
function addPetParticles(lines: string[], tick: number): string[] {
	const hearts = PET_HEARTS[tick % PET_HEARTS.length]
	return [...hearts, ...lines]
}

/**
 * Reverse a line's visible characters while preserving leading ANSI codes.
 * Handles simple cases: ANSI at start + visible text.
 */
function reverseLine(line: string): string {
	// eslint-disable-next-line no-control-regex
	const ansiMatch = line.match(/^(\x1b\[[0-9;]*m)+/)
	const stripped = line.replace(/\x1b\[[0-9;]*m/g, '')
	const reversed = stripped.split('').reverse().join('')
	return ansiMatch ? ansiMatch[0] + reversed : reversed
}
