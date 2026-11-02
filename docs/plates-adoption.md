# isocan under keel: what stayed its own

Written by `keel adopt` on practice 0.6.7. Keel switched on only the practices this project already satisfies; where it has its own version, nothing was installed and a proposal is recorded here and in `.keel/keel.json` (`local`). The project's gate is `npm test && npm run typecheck`.

Decide each proposal in review: keep yours (eject), take keel's, or send yours upstream as a lesson.

## Practices

| Practice | State | Why |
| --- | --- | --- |
| base | on | the project satisfies it |
| agents-md | on | the project satisfies it |
| phases | local | phases live in docs/projects/<project>/phases.md (37 projects) with **Status:** lines; keel reads them read-only (keel next --project <p>, keel status) and never writes them or a roadmap; keel's docs/phases/ is not installed; scripts/roadmap.mjs is the project's own (differs from keel's); proposal: keep yours (eject), take keel's, or send yours upstream as a lesson |
| evidence | local | phases are in the projects shape: each phase's **Status:** line carries its proof; keel's evidence files serve docs/phases/ |
| lessons | on | the project satisfies it |
| conduct | local | this repo is conduct's upstream source (dglazkov/isocan .claude/skills/conduct/SKILL.md); keel never seeds a copy of it here, and never installs .agents/skills/conduct/SKILL.md or .claude/skills/conduct beside it |
| ci | local | the project has workflows (changelog.yml, grade.yml, journeys.yml, loop.yml, persona.yml, pr.yml, practice.yml, release.yml, review.yml); keel's check.yml is not added beside them, since that would run the gate twice; proposal: point the workflow that gates pushes at `npm test && npm run typecheck`, or replace it with keel's check.yml |
| night | local | the project runs its own night shift (scripts/night.mjs, npm run night); keel's keel-night.yml and scripts/keel/ are not added beside it; proposal: keep yours, or compare its measures with keel's improve and retire one |
| claude | local | changelog.yml already runs anthropics/claude-code-action; keel's claude.yml is not added beside it, so one mention gets one answer; proposal: keep it, or let keel manage it as claude.yml |
| renovate | local | renovate.json is the project's own (differs from keel's); proposal: keep yours (eject), take keel's, or send yours upstream as a lesson |
| loop | local | the project triages Loop with its own scripts/loop.mjs; proposal: render docs/LOOP.md with keel's scripts/loop.mjs in a copy and compare it with yours (only the generated-by line should differ), keep your wording with .keel/keel.json "loop" {run, insights}, then retire yours for keel's; scripts/loop.mjs is the project's own (differs from keel's); proposal: keep yours (eject), take keel's, or send yours upstream as a lesson |
| reconciliation | off | optional; --with reconciliation to add it |

## Local variants and proposals

### phases

phases live in docs/projects/<project>/phases.md (37 projects) with **Status:** lines; keel reads them read-only (keel next --project <p>, keel status) and never writes them or a roadmap; keel's docs/phases/ is not installed; scripts/roadmap.mjs is the project's own (differs from keel's); proposal: keep yours (eject), take keel's, or send yours upstream as a lesson

### evidence

phases are in the projects shape: each phase's **Status:** line carries its proof; keel's evidence files serve docs/phases/

### conduct

this repo is conduct's upstream source (dglazkov/isocan .claude/skills/conduct/SKILL.md); keel never seeds a copy of it here, and never installs .agents/skills/conduct/SKILL.md or .claude/skills/conduct beside it

### ci

the project has workflows (changelog.yml, grade.yml, journeys.yml, loop.yml, persona.yml, pr.yml, practice.yml, release.yml, review.yml); keel's check.yml is not added beside them, since that would run the gate twice; proposal: point the workflow that gates pushes at `npm test && npm run typecheck`, or replace it with keel's check.yml

### night

the project runs its own night shift (scripts/night.mjs, npm run night); keel's keel-night.yml and scripts/keel/ are not added beside it; proposal: keep yours, or compare its measures with keel's improve and retire one

### claude

changelog.yml already runs anthropics/claude-code-action; keel's claude.yml is not added beside it, so one mention gets one answer; proposal: keep it, or let keel manage it as claude.yml

### renovate

renovate.json is the project's own (differs from keel's); proposal: keep yours (eject), take keel's, or send yours upstream as a lesson

### loop

the project triages Loop with its own scripts/loop.mjs; proposal: render docs/LOOP.md with keel's scripts/loop.mjs in a copy and compare it with yours (only the generated-by line should differ), keep your wording with .keel/keel.json "loop" {run, insights}, then retire yours for keel's; scripts/loop.mjs is the project's own (differs from keel's); proposal: keep yours (eject), take keel's, or send yours upstream as a lesson

## Files kept as the project's own

- `package.json` (base)
- `.nvmrc` (base)
- `.gitignore` (base)
- `AGENTS.md` (agents-md)
- `scripts/roadmap.mjs` (phases) — differs from keel's
- `docs/reviews/lessons.md` (lessons)
- `renovate.json` (renovate) — differs from keel's
- `scripts/loop.mjs` (loop) — differs from keel's
- `.stitch.json` (loop)

## Blocks not appended

None.

## Conflicts

- `.claude/skills/conduct` (conduct) — exists and is not a symlink; keel's is a link to ../../.agents/skills/conduct
