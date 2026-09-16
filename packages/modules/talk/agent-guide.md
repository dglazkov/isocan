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
