import React, { useEffect, useState } from 'react'
import { Box, Text, type Color, stringWidth } from '@anthropic/ink'
import type { AnimMode } from '../types'
import { renderAnimatedSprite, getIdleAnimMode } from '../sprites/renderer'

interface SpriteAnimatorProps {
	/** Base sprite lines (before animation transforms) */
	lines: string[]
	/** Text color for the sprite */
	color?: Color
	/** Tick interval in milliseconds (default 500) */
	tickMs?: number
	/** Single animation mode. Omit for idle sequence auto-play */
	mode?: AnimMode
	/** Whether to center the sprite horizontally (default true) */
	centered?: boolean
	/** Extra content to render above the sprite (e.g. hearts) */
	overlay?: string[] | null
}

/**
 * Animated sprite renderer with built-in tick loop.
 *
 * Renders base sprite lines with animation transforms applied per-tick.
 * Uses the idle sequence by default; pass `mode` to force a single animation.
 *
 * @example
 * ```tsx
 * // Idle animation, auto-centered
 * <SpriteAnimator lines={spriteLines} color="ansi:blue" />
 *
 * // Forced excited mode
 * <SpriteAnimator lines={spriteLines} mode="excited" />
 *
 * // With heart overlay
 * <SpriteAnimator lines={spriteLines} overlay={heartLines} />
 * ```
 */
export function SpriteAnimator({
	lines,
	color,
	tickMs = 500,
	mode,
	centered = true,
	overlay,
}: SpriteAnimatorProps) {
	const [tick, setTick] = useState(0)

	useEffect(() => {
		const timer = setInterval(() => setTick(t => t + 1), tickMs)
		return () => clearInterval(timer)
	}, [tickMs])

	const currentMode = mode ?? getIdleAnimMode(tick)
	const animated = renderAnimatedSprite(lines, tick, currentMode)
	const displayLines = overlay ? [...overlay, ...animated] : animated

	const spriteBlock = (
		<Box flexDirection="column">
			{displayLines.map((line, i) => (
				<Text key={i} color={color}>{line}</Text>
			))}
		</Box>
	)

	if (!centered) return spriteBlock

	return (
		<Box flexDirection="row" justifyContent="center" width="100%">
			{spriteBlock}
		</Box>
	)
}
