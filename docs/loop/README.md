# Loop findings

One file per Stitch Loop insight, named by its slug. The front matter holds
Loop's side (`loop` ids, `loop_rank`, `loop_state`, `loop_goal`) and ours
(`decision`, `rank`, `phase` or `project`, `lesson`, `since`, `note`); the body holds
Loop's claim and, under `## Our read`, what the code actually shows.

- `decision`: `untriaged` → `proposed` (an agent's read) → `accepted`,
  `declined`, `stale` or `done` (a person's). Declined and stale are dismissed
  in Loop.
- `rank`: `now`, `next`, `later`, `never`: ours, never Loop's P0–P3.
- `phase`: the `docs/phases/` number the work belongs to, or `new`. In a
  projects-shaped repo (`.keel/keel.json` `"phases": {"shape": "projects"}`)
  it is `project` instead: the `docs/projects/<name>/` directory, or `new`.

`docs/LOOP.md` is generated from these files by `node scripts/loop.mjs render`
and checked by `tests/loop.test.mjs`, so the project's gate fails when it is
stale or a finding is broken. Keep that test in what the gate runs.

Edit a finding by hand if you must, then `node scripts/loop.mjs render`.
