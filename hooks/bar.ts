// ultrathink-mod: the bar's rules, as plain functions with no mods API calls,
// so the tests can check them directly.

import type { UltrathinkWindow } from '../types'

export const WORD = 'ultrathink'

// The colors Claude Code paints the word ultrathink in, one per letter (its
// theme's rainbow_* keys), and the lighter ones its shimmer runs through.
export const RED = '#EB5F57'
export const ORANGE = '#F58B57'
export const YELLOW = '#FAC35F'
export const BLUE = '#82AADC'
export const VIOLET = '#C882B4'
export const RAINBOW = [RED, ORANGE, YELLOW, '#91C882', BLUE, '#9B82C8', VIOLET]
export const SHIMMER = ['#FA9B93', '#FFB989', '#FFE19B', '#B9E6B4', '#B4CDF0', '#C3B4E6', '#E6B4D2']

/** How long the prompt cache stays warm after the last request. */
export const TTL_MS = 60 * 60 * 1000

export type Level = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export const LEVELS: readonly Level[] = ['low', 'medium', 'high', 'xhigh', 'max']

const NAMES: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: 'spend' }
const ORDER: Record<string, number> = { five_hour: 0, seven_day: 1 }

export type Letter = { ch: string; color: string }

/**
 * The word in rainbow letters. Given a frame, a band of lighter letters stands
 * at that point of its run through the word, as the terminal's shimmer does.
 */
export function letters(word: string, frame: number | null): Letter[] {
  const at = frame === null ? null : (frame % (word.length + 4)) - 2
  const pick = (list: readonly string[], i: number): string => list[i % list.length] ?? RED
  return [...word].map((ch, i) => ({
    ch,
    color: at !== null && Math.abs(i - at) <= 1 ? pick(SHIMMER, i) : pick(RAINBOW, i),
  }))
}

/** The level Ultrathink asks for: xhigh, or high on Opus 4.6 and Sonnet 4.6, which have no xhigh. */
export function target(model: string | null): Level {
  return /4[-._]6/.test(model ?? '') ? 'high' : 'xhigh'
}

/**
 * The effort a boosted request runs at, or null where the boost changes
 * nothing: a model with no effort, a numeric budget, or a level already at
 * or above the target. Never lower than what you run.
 */
export function boosted(model: string | null, effort: string | number | null | undefined): Level | null {
  if (effort === undefined || effort === null || typeof effort === 'number') return null
  const want = target(model)
  return LEVELS.indexOf(effort as Level) >= LEVELS.indexOf(want) ? null : want
}

/** What Claude reads beside a boosted message, so it knows the level it runs at. */
export function noteFor(level: string): string {
  return `The person pressed Ultrathink for this message, so Claude Code sends this turn's requests at ${level} effort, and the effort value you see this turn is that level's. Their /effort setting is unchanged.`
}

/** The context window's fill, in whole percent, or null before it is known. */
export function contextPercent(c: { tokens?: number; window: number; percent?: number }): number | null {
  if (typeof c.percent === 'number') return Math.round(c.percent)
  if (c.tokens && c.window > 0) return Math.round((c.tokens / c.window) * 100)
  return null
}

/** The usage windows, 5H first, kept to what the bar draws. */
export function windowsOf(list: readonly UltrathinkWindow[]): UltrathinkWindow[] {
  return list
    .map(w => ({ kind: w.kind, percentUsed: w.percentUsed, resetsAt: w.resetsAt }))
    .sort((a, b) => (ORDER[a.kind] ?? 9) - (ORDER[b.kind] ?? 9))
}

export function nameOf(kind: string): string {
  return NAMES[kind] ?? kind
}

/** How full a meter is (context, a usage window), in its ring's color: blue, yellow from 80%, red from 95%. */
export function usedColor(percent: number): string {
  return percent >= 95 ? RED : percent >= 80 ? YELLOW : BLUE
}

/** What is used of a window, in whole percent. */
export function usedOf(w: UltrathinkWindow): number {
  return Math.max(0, Math.min(100, Math.round(w.percentUsed)))
}

/** The terminal's ring: a circle filled by quarters. */
export function pie(percent: number): string {
  return percent < 13 ? '○' : percent < 38 ? '◔' : percent < 63 ? '◑' : percent < 88 ? '◕' : '●'
}

const RING_R = 7
const RING_LEN = 2 * Math.PI * RING_R

/** The desktop's ring: a track and an arc filled to the percent, drawn once, with no animation. */
export function ringSvg(percent: number, color: string): string {
  const filled = ((RING_LEN * Math.max(0, Math.min(100, percent))) / 100).toFixed(2)
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">' +
    `<circle cx="9" cy="9" r="${RING_R}" fill="none" stroke="#8a8880" stroke-opacity=".35" stroke-width="2.5"/>` +
    `<circle cx="9" cy="9" r="${RING_R}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" ` +
    `stroke-dasharray="${filled} ${RING_LEN.toFixed(2)}" transform="rotate(-90 9 9)"/></svg>`
  )
}

/** A span of time, short: 45m, 3h 10m, 2d 4h. */
export function span(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60000))
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ${mins % 60}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

/**
 * The prompt cache: warm with the minutes left, or cold with how long it has
 * been idle, and the share of the hour left; null before the first request.
 */
export function cacheOf(lastAt: number, now: number): { isWarm: boolean; text: string; percentLeft: number } | null {
  if (lastAt <= 0) return null
  const idle = Math.max(0, now - lastAt)
  return idle < TTL_MS
    ? {
        isWarm: true,
        text: `warm ${Math.max(1, Math.ceil((TTL_MS - idle) / 60000))}m`,
        percentLeft: Math.round(((TTL_MS - idle) / TTL_MS) * 100),
      }
    : { isWarm: false, text: `cold ${span(idle)}`, percentLeft: 0 }
}
