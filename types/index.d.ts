/** One usage window: `five_hour`, `seven_day`, a gateway's `spend_limit`. */
export type UltrathinkWindow = { kind: string; percentUsed: number; resetsAt?: string }

/** What the bar's meters show: how full the context is, and each usage window. */
export type UltrathinkMeters = { context: number | null; windows: UltrathinkWindow[] }

/** The Ultrathink button's state, and the level the last main request asked for. */
export type UltrathinkState = {
  /** Pressed before sending: the next message you send gets the boost. */
  armed: boolean
  /** That message was sent; the turn it starts gets the boost. */
  pending: boolean
  /** The main-loop turn running boosted, by its turnId. */
  boostTurn: string | null
  /** The main-loop turn in progress, by its turnId. */
  currentTurn: string | null
  /** The effort the last main request was asked at, before any boost. */
  effort: string | null
  /** The model of the last main request. */
  model: string | null
}

declare module 'claude-code' {
  interface PluginState {
    'ultrathink-mod': { meters: UltrathinkMeters; lastAt: number; ultra: UltrathinkState }
  }
}
