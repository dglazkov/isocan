## 3D models

Upload self-contained GLB 2.0 (`.glb`) 3D models, validate their binary headers,
and record camera poses or derived poster snapshots.

- `isocan model3d inspect <item> [--json]` — validate a GLB 2.0 item's binary
  header (magic, version, containment, byte length) and print its camera pose.
- `isocan model3d capture-view <item> [--pose <az,el,dist>] [--poster <file>] [--json]` —
  save `model3d.camera` on the item and optionally upload `--poster` as a derived
  image linked via `model3d.posterItem`.

MCP agents receive the same verbs as `model3d_inspect` and
`model3d_capture_view`.
