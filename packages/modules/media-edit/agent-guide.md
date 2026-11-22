## Media

Local FFmpeg media primitives on video and audio canvas items. Every edit lands a new derived item with `parent` provenance.

- `isocan clip trim <item> --start <sec> --end <sec> [--json]` — trim a video or audio clip to `[start, end]`.
- `isocan clip stitch <item1> <item2> [items...] [--json]` — concatenate two or more clips in order.
- `isocan clip mux <video> <audio> [--json]` — combine a video item and an audio item into one clip.
- `isocan clip frames <item> [--fps <n>] [--json]` — extract PNG frames from a video item onto the canvas.

MCP agents receive `media_edit_trim`, `media_edit_stitch`, `media_edit_mux`, and `media_edit_frames`.
