// ultrathink-mod: one bar above the prompt with the context window, the prompt
// cache, the 5-hour and 7-day limits, the effort level, and an Ultrathink button
// in the rainbow letters Claude Code paints the word ultrathink in.
//
// The button, before you send, runs your next message at xhigh; while Claude
// works, it raises the rest of that turn; a second press cancels. /ultra does the
// same. Only that turn's main requests change: your /effort setting stays, a
// level at or above xhigh stays, subagents keep theirs, and Opus 4.6 and Sonnet
// 4.6, which have no xhigh, get high. A boosted message also tells Claude the
// level it runs at, so it answers truly when asked.
//
// The terminal draws the meters as circle glyphs and the button as a Button
// (type 0 into an empty prompt to press it). The desktop draws each meter as a
// ring and the button as a Client (ultra-client.tsx), since a desktop Button is
// native and drops the letters' colors.
//
// No model calls: the bar reads the engine's own figures and draws.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { UltrathinkMeters, UltrathinkState } from '../types'
import {
  BLUE, ORANGE, VIOLET, WORD,
  boosted, cacheOf, contextPercent, letters, nameOf, noteFor, pie, ringSvg, target, usedColor, usedOf, windowsOf,
} from './bar'
import type { UltraProps } from './ultra-client'

const IDLE: UltrathinkState = { armed: false, pending: false, boostTurn: null, currentTurn: null, effort: null, model: null }

const meters = atom({ plugin: 'ultrathink-mod', key: 'meters' } as const, { context: null, windows: [] } as UltrathinkMeters)
const lastAt = atom({ plugin: 'ultrathink-mod', key: 'lastAt' } as const, 0)
const ultra = atom({ plugin: 'ultrathink-mod', key: 'ultra' } as const, IDLE)

/** How often the bar redraws, so the cache countdown stays current. */
const TICK_MS = 30_000
/** How fast the shimmer runs through the word while Ultrathink is on. */
const SHIMMER_MS = 120
/** Under this many columns the button gets a row of its own. */
const WIDE = 110

let shimmer: Timer | null = null
let frame = 0
// The terminal's shimmer redraws the bar; the desktop's runs inside its Client.
let drawsTerminal = false

const isOn = (s: UltrathinkState): boolean => s.armed || s.pending || s.boostTurn !== null

/** Runs the terminal's shimmer while Ultrathink is on, and stops it when it goes off. */
function syncShimmer($: EngineInterface, s: UltrathinkState): void {
  if (isOn(s) && drawsTerminal && shimmer === null) {
    shimmer = $.clock.every(SHIMMER_MS, () => {
      frame += 1
      $.ui.invalidate('ui.render')
    })
  } else if (!isOn(s) && shimmer !== null) {
    shimmer.cancel()
    shimmer = null
    frame = 0
  }
}

async function pull($: EngineInterface): Promise<void> {
  const u = await $.session.usage()
  await update($, meters, () => ({ context: contextPercent(u.context), windows: windowsOf(u.rateLimits) }))
}

// What a press does: while a turn runs, raise (or lower) the rest of it;
// otherwise arm (or disarm) the next message. Returns a line saying so.
async function press($: EngineInterface, working: boolean): Promise<string> {
  let said = ''
  const s = await update($, ultra, u => {
    if (working && u.currentTurn !== null) {
      if (u.boostTurn === u.currentTurn) {
        said = 'Ultrathink off: the rest of this turn goes back to your level.'
        return { ...u, boostTurn: null }
      }
      said = 'Ultrathink on: the rest of this turn runs at xhigh.'
      return { ...u, boostTurn: u.currentTurn }
    }
    said = u.armed ? 'Ultrathink off for your next message.' : 'Ultrathink on: your next message runs at xhigh.'
    return { ...u, armed: !u.armed }
  })
  syncShimmer($, s)
  return said
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: 'ultra',
        description: 'Ultrathink: run your next message (or, while Claude works, the rest of this turn) at xhigh effort',
        immediate: true,
      })
    } catch {
      // The name is taken; the button still works.
    }
    const result = await next(e)
    await pull($).catch(() => undefined)
    $.clock.every(TICK_MS, () => $.ui.invalidate('ui.render'))
    syncShimmer($, await read($, ultra))
    return result
  })

  on('session.measure', async ($, e, next) => {
    const hasContext = e.changed.includes('context')
    const hasLimits = e.changed.includes('rateLimits')
    if (hasContext || hasLimits) {
      await update($, meters, m => ({
        context: hasContext ? (contextPercent(e.context) ?? m.context) : m.context,
        windows: hasLimits ? windowsOf(e.rateLimits) : m.windows,
      }))
    }
    return next(e)
  })

  // An armed message carries the boost to its turn, and a note so Claude knows it.
  on('prompt.submit', async ($, e, next) => {
    const s = await read($, ultra)
    if (!s.armed || e.command || e.isMeta || !e.text.trim()) {
      return next(e)
    }
    await update($, ultra, u =>
      e.turnId ? { ...u, armed: false, boostTurn: e.turnId } : { ...u, armed: false, pending: true },
    )
    const level = s.effort === null ? target(s.model) : boosted(s.model, s.effort)
    return next(level ? { ...e, context: [...(e.context ?? []), noteFor(level)] } : e)
  }).catch(($, e, next) => next(e)) // never hold up a prompt

  on('turn.start', async ($, e, next) => {
    if (!e.agentId) {
      await update($, ultra, u => ({
        ...u,
        currentTurn: e.turnId,
        pending: false,
        boostTurn: u.pending ? e.turnId : u.boostTurn,
      }))
    }
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId) {
      return yield* next(e)
    }
    const now = await $.clock.now()
    await update($, lastAt, () => now)
    const s = await update($, ultra, u => ({
      ...u,
      currentTurn: e.turnId,
      effort: typeof e.effort === 'string' ? e.effort : u.effort,
      model: e.model,
    }))
    if (s.boostTurn === e.turnId) {
      const effort = boosted(e.model, e.effort)
      if (effort) {
        return yield* next({ ...e, effort })
      }
    }
    return yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) {
      const s = await update($, ultra, u => ({
        ...u,
        boostTurn: u.boostTurn === e.turnId ? null : u.boostTurn,
        currentTurn: u.currentTurn === e.turnId ? null : u.currentTurn,
      }))
      syncShimmer($, s)
      await pull($).catch(() => undefined)
    }
    return next(e)
  })

  on('command.run', { command: 'ultra' }, async $ => {
    const s = await read($, ultra)
    await $.ui.toast(await press($, s.currentTurn !== null))
    return {}
  })

  // A click on the desktop's Ultrathink control (ultra-client.tsx).
  on('ui.message', async ($, e, next) => {
    const data = e.data as { press?: unknown; isWorking?: unknown } | null
    if (e.element !== 'ultrathink' || !data || data.press !== true) {
      return next(e)
    }
    await press($, data.isWorking === true)
    return {}
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }
    const ui = $.ui.resolve(e)
    const { Box, Button, Text } = ui
    const desktop = e.surface === 'desktop' && 'Svg' in ui && 'Client' in ui ? ui : null
    if (e.surface === 'terminal') drawsTerminal = true
    const m = await read($, meters)
    const s = await read($, ultra)
    const cache = cacheOf(await read($, lastAt), await $.clock.now())
    const isWide = (e.props.bodyColumns || 80) >= WIDE
    const live = e.props.isWorking && s.currentTurn !== null
    const isBoosting = live && s.boostTurn === s.currentTurn
    const isArmed = !live && (s.armed || s.pending)
    const level = isBoosting ? (boosted(s.model, s.effort) ?? s.effort) : s.effort

    // A meter: its ring (an Svg on the desktop, a circle glyph in the terminal), its figure, its name.
    const meter = (key: string, percent: number, color: string, value: string, name: string) => (
      <Box key={key} flexDirection="row" flexShrink={0} alignItems="center" marginRight={2}>
        {desktop ? (
          <desktop.Svg source={ringSvg(percent, color)} alt={`${name} ${value}`} width={18} height={18} />
        ) : (
          <Text color={color}>{pie(percent)}</Text>
        )}
        <Text bold>{` ${value}`}</Text>
        <Text dimColor>{` ${name}`}</Text>
      </Box>
    )
    const meterRow = [
      m.context !== null ? meter('context', m.context, usedColor(m.context), `${m.context}%`, 'context') : null,
      ...m.windows.map(w => meter(`w-${w.kind}`, usedOf(w), usedColor(usedOf(w)), `${usedOf(w)}%`, nameOf(w.kind))),
      cache ? meter('cache', cache.percentLeft, cache.isWarm ? ORANGE : BLUE, cache.text, 'cache') : null,
      level ? (
        <Box key="effort" flexDirection="row" flexShrink={0} alignItems="center" marginRight={2}>
          <Text dimColor>effort </Text>
          <Text color={isBoosting ? VIOLET : undefined} bold>
            {level}
          </Text>
        </Box>
      ) : null,
    ].filter(part => part !== null)

    // While it is on, the word shimmers; nothing else is drawn beside it.
    const ultraProps: UltraProps = { isOn: isBoosting || isArmed, isWorking: Boolean(e.props.isWorking) }
    const word = letters(WORD, ultraProps.isOn ? frame : null)
    const ultraPart = desktop ? (
      <Box key="ultra" flexDirection="row" flexShrink={0}>
        <desktop.Client key="ultrathink" module="./ultra-client.tsx" props={ultraProps} />
      </Box>
    ) : (
      <Box key="ultra" flexDirection="row" flexShrink={0}>
        <Button key="ultrathink" label="Ultrathink" hotkey="0" plain onPress={() => press($, Boolean(e.props.isWorking))}>
          {'⚡ '}
          {word.map((l, i) => (
            <Text key={`l${i}`} color={l.color} bold>
              {l.ch}
            </Text>
          ))}
        </Button>
      </Box>
    )

    const mine = isWide ? (
      <Box flexDirection="row" paddingX={1}>
        {meterRow}
        <Box key="grow" flexGrow={1} />
        {ultraPart}
      </Box>
    ) : (
      <Box flexDirection="column" paddingX={1}>
        {meterRow.length > 0 ? (
          <Box key="meters" flexDirection="row" flexWrap="wrap">
            {meterRow}
          </Box>
        ) : null}
        {ultraPart}
      </Box>
    )
    const theirs = await next(e)
    return theirs ? (
      <Box flexDirection="column">
        {mine}
        {theirs}
      </Box>
    ) : (
      mine
    )
  })
}
