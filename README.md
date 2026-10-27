# ultrathink-mod

A free mod for Claude Code. It adds one bar above your prompt:

```text
○ 9% context  ○ 5% 5h  ◑ 42% 7d  ● warm 53m cache  effort high      0: ⚡ ultrathink
```

- **context**: how full the context window is.
- **5h** and **7d**: how much of your 5-hour and 7-day usage you have used.
- **cache**: whether the prompt cache is warm (with the minutes left) or cold. It counts one hour from the last request.
- **effort**: the effort level your requests run at.
- **⚡ ultrathink**: a button in the same rainbow letters Claude Code uses for the word ultrathink.

In the Desktop app each meter is a ring. In the terminal it is a circle that fills by quarters.

It works in the terminal and in the Claude Desktop app. It makes no model calls: it reads Claude Code's own figures.

## The Ultrathink button

- **Before you send:** press it, and your next message runs at `xhigh` effort. The word shimmers while it is on.
- **While Claude works:** press it, and the rest of that turn runs at `xhigh`. The effort meter shows `xhigh` for that turn.
- **Press again** to cancel.

How to press it:

- **Desktop app:** click it.
- **Terminal:** type `0` into the empty prompt and wait a moment. With fullscreen rendering you can also click it.
- **Anywhere:** type `/ultra`.

What it never does:

- It never changes your `/effort` setting. Only that one turn changes.
- It never lowers your level. At `xhigh` or `max` it changes nothing.
- It leaves subagents at their own level.
- Opus 4.6 and Sonnet 4.6 have no `xhigh`, so they get `high`.

A boosted message also tells Claude the level it runs at, so it answers truly when you ask.

## Install

At the prompt of a Claude Code terminal session:

```text
/plugin install ultrathink-mod --marketplace ydarwish1/ultrathink-mod
```

1. Type `y` when it asks `Add marketplace?`.
2. Pick the **user** scope with Enter.
3. Start a new session.

From a shell:

```bash
claude plugin install ultrathink-mod --marketplace ydarwish1/ultrathink-mod
```

In the Desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `ydarwish1/ultrathink-mod`, then **Add plugin**.

You need Claude Code 2.1.287 or later, where mods load by default.

## Other bars

If another mod also draws usage above the prompt, you see it twice. With the skins mod, type `/skin band off` to hide its bar. The mod effortlevelmod has its own Ultrathink button on the same `0` key, so use one or the other.

## Tests

```bash
claude plugin test .
```

## License

MIT
