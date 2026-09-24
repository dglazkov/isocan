## isocan voice

`isocan voice` says where the browser voice lives: open the canvas in the web
app and choose **Configure voice** (⌘K, Canvas group) — that is the settings
door (key and model); the floating mic is the talking. The dialog opens a
Gemini Live session from that browser with that person's own API key — the
key is stored in the browser's storage, never on the canvas and never in the
daemon — and hands the model the canvas's operations as tools, so a spoken
request lands as the same operations a click would send, carrying the
speaker's identity and undo.

Prefer the enrolled voice harness (`isocan rc add <name> --harness voice`) for
a standing agent the canvas can summon; the browser dialog is for the person
who is already in the app.

The voice settings also carry **Fast path in shadow** (off by default): Jev
resolves each spoken turn into a simple act and records it beside what the
model did, never acting. An agent measures the resolver without a browser:
`node --import tsx packages/modules/talk/scripts/fast-path-eval.ts` (with
`TYPESAFE_API_KEY`), or `--record <fast-path-shadow.jsonl>` for a person's
exported record.
