## Video generation

Start a home-polled async video generation job on the canvas. A placeholder item
appears immediately and the home polls the provider in the background until the
finished MP4 lands as a new version — closing the tab or disconnecting never
stops the job.

- `isocan video "<prompt>" [--from <item>] [--model <id>] [--duration <4|6|8|10>] [--json]`
  — start a video job (`POST /api/m/video/generate`) and return the placeholder
  item id and job id.
- `isocan video generate "<prompt>" [--from <item>] [--model <id>] [--json]` —
  explicit subcommand form of the same act.
- Check or control the running job with `isocan job status <jobId>`,
  `isocan job cancel <jobId>`, or `isocan job retry <jobId> [--model <id>]`.

MCP agents receive the same verb as `video_generate` (`{ prompt, fromItem?, model? }`).
