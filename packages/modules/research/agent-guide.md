## Research

Start a home-polled grounded research job that lands a cited Markdown report on the canvas.

- `isocan research "<query>" [--deep] [--json]` — start a research job (`POST /api/m/research/run`) and return the placeholder item id and job id.
- `isocan research run "<query>" [--deep] [--json]` — explicit subcommand form of the same act.
- Check or control the running job with `isocan job status <jobId>`, `isocan job cancel <jobId>`, or `isocan job retry <jobId>`.

MCP agents receive the same verb as `research_run` (`{ query, deep? }`).
