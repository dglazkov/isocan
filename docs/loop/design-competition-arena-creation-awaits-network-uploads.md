---
title: Design competition arena creation awaits network uploads
loop:
  - 5ac400aa-1c19-4937-9180-998e150cd830
loop_rank: P2
loop_state: ACTIVE
loop_goal: Fast everywhere, local-first
decision: proposed
rank: never
project: design-competition
since: 2026-10-07
note: "True mechanism, same shape as declined serial-upload findings: lay() uploads each fighter's 4 small markdown/SVG pack blobs and the brief before sending arenaPlan.ops (design-competition/src/web.tsx:178-208). Reopen if arena setup latency is measured as a bottleneck."
---

# Design competition arena creation awaits network uploads

> **Loop says** (P2): Laying out a design competition arena fetches fighter assets and sequentially awaits multiple remote HTTP uploads. The UI dispatches canvas operations created by arena plan after all blob uploads finish. Synchronous network operations block local arena creation and cause interface delays.

- `packages/modules/design-competition/src/web.tsx#L174-L215`

## Our read

Verified in packages/modules/design-competition/src/web.tsx:174-215: lay() iterates over the 2-3 chosen fighters (line 183), reads avatar.svg, DESIGN.md, and references.md in parallel via Promise.all (line 184), and awaits mint() (which calls host.putBlob at line 179) for area, card, design, and shelf blobs (lines 186-190) plus the brief blob (line 204) before constructing arenaPlan (line 193) and dispatching plan.ops in a single undo group via host.send(plan.ops, newGroupId()) (line 208). All blobs must have content hashes before arenaPlan builds the atomic group creation operations, and starting a competition bout requires a live daemon/rc to enrol fighter agents (lines 216-225). Parallelizing the mint() calls with Promise.all would be a minor optimization on a one-off setup gesture, matching the declined serial-http-uploads-stall-multi-file-drop-processing finding.
