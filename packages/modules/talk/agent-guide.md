## isocan voice

`isocan voice` says where the browser voice lives: open the canvas in the web
app and choose **Configure voice** (⌘K, Canvas group) — that is the settings
door (the model); the floating mic is the talking. The dialog opens a
Gemini Live session from that browser with a one-use token the home mints
(`POST /api/m/talk/token`) from the Gemini key in its Model keys (`isocan keys
set gemini` on the machine that holds the canvas) — no key reaches the
browser — and hands the model the canvas's operations as tools, so a spoken
request lands as the same operations a click would send, carrying the
speaker's identity and undo.

Prefer the enrolled voice harness (`isocan rc add <name> --harness voice`) for
a standing agent the canvas can summon; the browser dialog is for the person
who is already in the app.

The voice settings also carry a **fast path** switch (off by default):
**in shadow**, Jev resolves each spoken turn into a simple act and records it
beside what the model did, never acting; **acting**, a move Jev is sure of
(above the threshold measured in `src/thresholds.ts`) is done at once through
the same tool code the model uses and the model's duplicate call is dropped.
An agent measures the resolver without a browser:
`node --import tsx packages/modules/talk/scripts/fast-path-eval.ts` (with
`TYPESAFE_API_KEY`), or `--record <fast-path-shadow.jsonl>` for a person's
exported record; `scripts/fast-path-act.ts` runs the acting path end to end
on a throwaway daemon. The browser's voice `undo` retracts the viewer's last
change, as ⌘Z does.

Subcommands for choreography and co-listening:
- `isocan voice disposition [--initiative <0..1>] [--curiosity <0..1>] [--divergence <0..1>] [--depth <0..1>] [--partnering <0..1>]` — normalizes the 5-axis disposition and prints the Live prompt hint.
- `isocan voice control <item> <play|pause|seek|rate|volume|status|find_by_transcript> [--time <sec>] [--rate <n>] [--volume <0..1>] [--query <text>]` — builds an ephemeral co-listening media command (never written to the oplog).
