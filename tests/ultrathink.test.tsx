import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, RenderSurface } from 'claude-code'

import { RAINBOW, boosted, letters, noteFor } from '../hooks/bar'

const band = <S extends RenderSurface>(surface: S, isWorking = false) =>
  ({
    plugin: 'ultrathink-mod',
    surface,
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking, maxRows: 10, bodyColumns: 120, scroll: { offset: 0, bodyRows: 10 }, view: {} },
  }) as const

// Nothing sits beneath the plugin: these hooks stand for the engine, and
// record the effort each request reaches it with.
function engine(on: On) {
  const efforts: unknown[] = []
  const contexts: (readonly string[])[] = []
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'ultra' } }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { tokens: 18000, window: 200000, percent: 9 },
      rateLimits: [
        { kind: 'seven_day', percentUsed: 42 },
        { kind: 'five_hour', percentUsed: 5 },
      ],
    },
  }))
  on('prompt.submit', (_, e) => {
    contexts.push(e.context ?? [])
    return { text: e.text, context: e.context }
  })
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.step', async function* (_, e) {
    efforts.push(e.agentId ? `${e.agentId}:${e.effort}` : e.effort)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: null }
  })
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('ui.toast', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 1_000_000 }))
  on('clock.every', () => ({ value: undefined }))
  // The engine's own band beneath: an empty box.
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return { efforts, contexts }
}

async function step($: Engine, turnId: string, index: number, effort: string, agentId?: string, model = 'claude-opus-5-5') {
  const stream = $.turn.step({ turnId, index, model, effort: effort as 'medium', messageCount: 1, ...(agentId ? { agentId } : {}) })
  let r = await stream.next()
  while (!r.done) r = await stream.next()
}

const start = ($: Engine, turnId: string) => $.turn.start({ text: 'go', turnId })
const complete = ($: Engine, turnId: string) =>
  $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId, reason: 'answer' })
const submit = ($: Engine, text: string) => $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })

test('the terminal draws circle glyphs and a rainbow Button', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount(band('terminal'))
  expect((await ui.find({ type: 'Button', key: 'ultrathink' }))?.text).toContain('ultrathink')
  const u = (await ui.findAll({ type: 'Text' })).find(t => t.text === 'u')
  expect(u?.props.color).toBe(RAINBOW[0])
  expect((await ui.find({ type: 'Text', text: '9%' }))?.text).toBe(' 9%')
  expect((await ui.find({ type: 'Text', text: '42%' }))?.text).toBe(' 42%')
  expect((await ui.find({ type: 'Text', text: '◑' }))?.text).toBe('◑')
  await ui.unmount()
})

test('the desktop draws rings, and a rainbow Client whose click arms the next message', async ($, on) => {
  const { efforts } = engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount(band('desktop'))
  expect(await ui.findAll({ type: 'Svg' })).toHaveLength(3)
  expect(await ui.find({ type: 'Button', key: 'ultrathink' })).toBe(undefined)
  const u = (await ui.findAll({ type: 'Text', in: 'ultrathink' })).find(t => t.text === 'u')
  expect(u?.props.color).toBe(RAINBOW[0])

  await ui.pointer({ type: 'down', x: 3, y: 0, button: 'left', in: 'ultrathink' })
  expect(((await ui.find({ type: 'Client', key: 'ultrathink' }))?.props.props as { isOn?: boolean } | undefined)?.isOn).toBe(true)

  // The shimmer runs inside the Client, on the surface's own clock.
  const colors = async () => (await ui.findAll({ type: 'Text', in: 'ultrathink' })).map(t => String(t.props.color)).join()
  const before = await colors()
  await ui.advance(240)
  expect(await colors()).not.toBe(before)
  await ui.unmount()

  await submit($, 'go')
  await start($, 't1')
  await step($, 't1', 0, 'medium')
  expect(efforts).toEqual(['xhigh'])
})

test('a press before sending runs only the next message at xhigh, and tells Claude', async ($, on) => {
  const { efforts, contexts } = engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount(band('terminal'))
  await ui.press({ key: 'ultrathink' })
  await ui.unmount()

  await submit($, 'why is the build slow?')
  expect(contexts[0]).toEqual([noteFor('xhigh')])

  await start($, 't1')
  await step($, 't1', 0, 'medium')
  await step($, 't1', 1, 'medium', 'a1')
  await step($, 't1', 2, 'medium')
  await complete($, 't1')

  await submit($, 'thanks')
  expect(contexts[1]).toEqual([])
  await start($, 't2')
  await step($, 't2', 0, 'medium')

  expect(efforts).toEqual(['xhigh', 'a1:medium', 'xhigh', 'medium'])
})

test('a press while Claude works raises the rest of that turn only', async ($, on) => {
  const { efforts } = engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  await start($, 't1')
  await step($, 't1', 0, 'high')
  const ui = await $.ui.mount(band('terminal', true))
  await ui.press({ key: 'ultrathink' })
  expect((await ui.find({ type: 'Text', text: 'xhigh' }))?.text).toBe('xhigh')
  await ui.unmount()
  await step($, 't1', 1, 'high')
  await complete($, 't1')

  await start($, 't2')
  await step($, 't2', 0, 'high')

  expect(efforts).toEqual(['high', 'xhigh', 'high'])
})

test('a second press cancels, and /ultra arms like the button', async ($, on) => {
  const { efforts, contexts } = engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount(band('terminal'))
  await ui.press({ key: 'ultrathink' })
  await ui.press({ key: 'ultrathink' })
  await ui.unmount()
  await submit($, 'one')
  await start($, 't1')
  await step($, 't1', 0, 'medium')
  await complete($, 't1')

  await $.command.run({ command: 'ultra', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })
  await submit($, 'two')
  await start($, 't2')
  await step($, 't2', 0, 'medium')

  expect(contexts[0]).toEqual([])
  expect(efforts).toEqual(['medium', 'xhigh'])
})

test('the boost never lowers a level, and gives 4.6 models high', () => {
  expect(boosted('claude-opus-5-5', 'max')).toBe(null)
  expect(boosted('claude-opus-5-5', 'xhigh')).toBe(null)
  expect(boosted('claude-opus-5-5', 'high')).toBe('xhigh')
  expect(boosted('claude-opus-4-6', 'medium')).toBe('high')
  expect(boosted('claude-haiku-4-5', undefined)).toBe(null)
  expect(boosted('claude-opus-5-5', 8000)).toBe(null)
})

test('the shimmer runs a lighter band through the word', () => {
  expect(letters('ultrathink', null).map(l => l.color)).toEqual([...RAINBOW, ...RAINBOW.slice(0, 3)])
  const lit = letters('ultrathink', 5)
  expect(lit.filter(l => !RAINBOW.includes(l.color)).map(l => l.ch).join('')).toBe('tra')
})
