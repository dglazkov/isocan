## Workbench (agent sessions & terminals)

Start and steer local agent or terminal sessions (`antigravity`, `gemini-cli`, `claude-code`, `pty`) on a canvas, materialize OpenNode batches, and launch debug loops on error items.

- `isocan workbench drivers [--json]` — list available session drivers and their models (`GET /api/m/workbench/drivers`).
- `isocan workbench sessions [--driver <id>] [--workspace <path>] [--json]` — list active/recent sessions (`GET /api/m/workbench/sessions`).
- `isocan workbench start --driver <id> [--kind session|terminal] [--workspace <path>] [--prompt <text>] [--command <cmd>] [--model <id>] [--title <title>] [--no-auto-preview] [--json]` — start a session item and tail dev-server URLs into live `site` items (`POST /api/m/workbench/start`).
- `isocan workbench send <sessionId> <text> --driver <id> [--json]` — send input to a running session (`POST /api/m/workbench/send`).
- `isocan workbench approve <sessionId> <interactionId> --driver <id> [--deny] [--json]` — resolve a pending approval/question (`POST /api/m/workbench/approve`).
- `isocan workbench cancel <sessionId> --driver <id> [--json]` — cancel a running session (`POST /api/m/workbench/cancel`).
- `isocan workbench emit [--file <path> | -] [--json]` — validate and materialize an OpenNode (`openstitch.node.v1|v2`) batch of nodes, edges, and patches (`POST /api/m/workbench/emit`).
- `isocan workbench debug <item> --driver <id> [--mode plan|fix] [--workspace <path>] [--json]` — bundle an item's error and context graph into a new debug session (`POST /api/m/workbench/debug`).

MCP agents receive `workbench_drivers`, `workbench_sessions`, `workbench_start`, and `workbench_emit`.
