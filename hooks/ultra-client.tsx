// ultrathink-mod: the Ultrathink control as the Desktop app draws it.
//
// The app draws a Button as its own native button, which drops the letters'
// colors. So on the desktop this Client draws the rainbow word itself, runs the
// shimmer on the app's own frame clock (the bar is not redrawn for it), and
// posts a click, or Enter once a click has focused it, to the hooks module.

import type { ClientModule } from 'claude-code'

import { WORD, letters } from './bar'

export type UltraProps = { isOn: boolean; isWorking: boolean }

// `latest` is the props of the last draw, read by the timer and the listeners.
type UltraState = { frame: number; latest: UltraProps }

/** How fast the shimmer runs through the word while Ultrathink is on. */
const SHIMMER_MS = 120

const UltraButton: ClientModule<UltraProps, UltraState> = (props, surface) => {
  const { Box, Text } = surface.elements

  if (surface.state === undefined) {
    const latest = { ...props }
    surface.setState({ frame: 0, latest })
    surface.every(SHIMMER_MS, () => {
      const s = surface.state
      if (s && s.latest.isOn) surface.setState({ frame: s.frame + 1, latest: s.latest })
    })
    const press = () => surface.post({ press: true, isWorking: surface.state?.latest.isWorking ?? props.isWorking })
    surface.onPointer(event => {
      if (event.type === 'down' && event.button === 'left') press()
    })
    surface.onKey(event => {
      if (event.key === 'return' || event.key === ' ') press()
    })
  } else {
    Object.assign(surface.state.latest, props)
  }

  const frame = props.isOn ? (surface.state?.frame ?? 0) : null

  return (
    <Box flexDirection="row">
      <Text bold>{'⚡ '}</Text>
      {letters(WORD, frame).map((l, i) => (
        <Text key={`l${i}`} color={l.color} bold>
          {l.ch}
        </Text>
      ))}
    </Box>
  )
}

export default UltraButton
