// ultrathink-mod: the click area of the Ultrathink key cap in the Desktop app.
//
// The desktop's cap is a picture (capSvg in bar.ts), since a Box there rounds
// no corners without a border a whole row thick, and a desktop Button is native
// and drops the letters' colors. This Client lies over the picture, draws
// nothing of its own, and posts a click, or Enter once a click has focused it,
// to the hooks module.

import type { ClientModule } from 'claude-code'

export type UltraProps = { isOn: boolean; isWorking: boolean }

// `latest` is the props of the last draw, read by the listeners.
type UltraState = { latest: UltraProps }

const UltraHit: ClientModule<UltraProps, UltraState> = (props, surface) => {
  const { Box } = surface.elements

  if (surface.state === undefined) {
    surface.setState({ latest: { ...props } })
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

  return <Box width="100%" height="100%" />
}

export default UltraHit
