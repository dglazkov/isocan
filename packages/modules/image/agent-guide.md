## Image

Generate or edit a single image on the canvas with your Gemini key.

- `isocan image "<prompt>" [--edit <item>] [--model <id>] [--json]` — generate
  a new image item, or pass `--edit <item>` to stack an edited version onto an
  existing item (`parent`, `derived-from`, `credentialRef`).
- `isocan image generate "<prompt>" [--edit <item>] [--model <id>] [--json]` —
  explicit subcommand form of the same act.

MCP agents receive the same verb as `image_generate` (`{ prompt, editItem?, model?, idempotencyKey? }`).
