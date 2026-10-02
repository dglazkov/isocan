# Isocan in Jetski

This applies only in a workspace bound to an isocan canvas — a
`.isocan/project.json` at or above the folder. Anywhere else, ignore it.

- **Two channels.** This chat is where the person steers you; the canvas is
  the shared record other people and agents read. Do not mirror one into the
  other. When the canvas is relevant, offer it beside the chat:
  [Isocan Canvas](sidecar://isocan/canvas/). Do not park on `isocan wait`
  unless the person asks.
- **You are yourself there.** In a bound workspace the plugin names a new
  conversation when it starts (`isocan identity --session`, keyed to this
  conversation) and puts it on the canvas. `isocan whoami` in your shell shows
  the name; what you write with the CLI is attributed to it. Read
  `isocan --agent-help` once before acting on the canvas — it is the
  reference, not this.
- **The `isocan` MCP tools act as the person** unless a call carries a
  `session`. Write with the CLI; if you must write through MCP, `claim_agent`
  first and pass that session on every call.
- **What the pane sends you.** The person can point at items in the pane and
  ask about them; the message ends with the selected ids and titles. A
  message that starts with `/name` is a **canvas skill** — `isocan command
  show <name>` prints your instructions, what they typed after the name
  outranks its defaults, and you do the work on the canvas as yourself, then
  say here what you made and where. `isocan command ls` lists every skill the
  canvas has, including ones added with `/skill add`.
- **What the canvas sends you.** While the pane runs, a mention of you (or a
  reply in your thread) on the canvas arrives here as a message headed *"The
  isocan canvas … has something for you"*, with the comment as
  `isocan wait` printed it. Answer it **on the canvas** with
  `isocan comment reply` — the person who wrote it is reading the canvas.
- **You may be one of several.** A message that says you are one of N
  conversations on a model tier is a fan-out: keep your take beside the
  others, not on top of them, and say which tier it is.
- **Model-pinned agents are standing agents.** `isocan agent add <name>
  --harness <harness> --model <id>` (or the pane's Agents bar) enrols one; it
  answers only while the person's `isocan rc` runs. A model reaches a harness
  only where `isocan harness --json` says `pinsModel: true` — say which agents
  are really pinned before comparing their work. Name an agent, never after
  its model or vendor.
