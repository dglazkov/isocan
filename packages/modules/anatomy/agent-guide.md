## Anatomy: a project's concepts on the canvas

Open the Anatomy workspace from the launcher. Its concepts are native items,
with native selection, movement, versions, comments and undo. Several projects
can share a canvas; use their item ids to avoid ambiguous names.

| Intent | Command |
| --- | --- |
| Start, import, find, read, export | `anatomy new <title>`, `anatomy import <file>`, `anatomy ls`, `anatomy show <project>`, `anatomy export <project> <file>` |
| Associate, attach, request analysis | `anatomy repository <path-or-url>`, `anatomy attach <project>`, `anatomy analyze [repository] [--analysis <id> | --new]`, `anatomy runs`, `anatomy run <request>` |
| Diagnose partial reads | `anatomy validate <project>`, `anatomy recover <project> <item> <version>` |
| Change intent or narrative | `anatomy goal <project> <text>`, `anatomy brief <project> <markdown-file>` |
| Create/edit a concept or directed relationship | `anatomy sample <project>`, `anatomy draft <project> <node>`, `anatomy node <project> <json-file>`, `anatomy edge <project> <json-file>` |
| Arrange and explore | `anatomy show <project> --node <original-id>`, `anatomy layout <project>`, `anatomy decisions <project>`, `anatomy coverage <project>` |
| Attach cited UTF-8 source bytes | `anatomy source <project> <source-id> <file>` |
| Propose or approve an HTML mock | `anatomy propose <project> <node-id> <html-file> --title <title> --constraints 'a;b'`, `anatomy promote <project> <node-id>` |
| Read/save/inspect/restore checkpoints | `anatomy checkpoint <project>`, `anatomy checkpoint <project> --save <title>`, `anatomy checkpoint <project> --show <id>`, `anatomy checkpoint <project> --restore <id>` |

All verbs take `--canvas`; reads support global `--json`. Import accepts the
prototype's `.anatomy.json` project export and always makes a fresh project.
It validates graph identities, parent cycles and edge endpoints before writes.
Export includes checkpoints and citations; attached source bytes remain canvas
files and travel in a normal canvas backup.

Concept JSON has `id`, `title`, `category` (goal/structure/data/rules), `status`
(settled/conflict/risk/missing), `summary`, optional `reason`, `conflictAxis`,
`parentId`/`parentRelation`, `evidence`, `resolutionOptions`, `marginalia`,
`lenses`, and `proposedMock`. Use domain concepts, workflows, states and
contracts, rather than implementation tickets. Explain unsettled concepts in
plain English. Missing discipline assessments mean not assessed, never settled.
`anatomy node` replaces the concept body. For an existing concept, start with
`anatomy draft <project> <node>`: edit its `node` fields while preserving `base`.
Save that JSON with `anatomy node`; stale drafts are refused by the daemon's
conditional `item.edit` operation. It changes body and metadata as one undo,
and preserves geometry. Plain concept JSON is accepted only for new concepts.
Keep citations and optional fields unless deliberately changing them. Edges have `id`, `from`, `to`,
optional `label` and `coupling` (tight/contract/loose), using original concept
ids. The canvas item ids are separate, and native properties map them.

Discuss with ordinary `comment add --item <item>`, `comment ls`, and `wait`.
Use ordinary `session` presence while actually working. A changed goal requests
reevaluation; it does not mark anything automatically analysed. Imported
activity and comments are historical provenance, not live agent activity.
Checkpoint restore changes only that project's concepts/edges and is undoable.
Mock promotion makes a source item and settles the concept in one undo group.

A canvas carries `anatomy.analysis` (the attached project item) and
`anatomy.repository` (the repository path or URL to analyze). Import/new attaches
only when there is no attachment and fills an unset repository; `attach` explicitly chooses another. Both are ordinary undoable
`project.update` properties. View Anatomy appears in the project menu and right
rail when an analysis exists; an associated repository offers Analyze repository.
`anatomy analyze` and the workspace's Ask agent action post `/anatomy` to Chat.
They request work from an agent with access; they do not themselves scan files or
start a model. `/anatomy` also works directly in Chat; read `isocan command show
anatomy` for the analysis instructions. Node exploration is a read: `show --node`
returns the focal concept, ancestors, parent/children and linked neighbors.


Exploration can read healthy concepts while reporting broken native files.
`anatomy validate` returns diagnostics, native item IDs and the readable subset;
`show` includes diagnostics when incomplete. Use native `get` and `versions` to inspect the named file. `anatomy recover`
restores the chosen valid historical body as a guarded, undoable new version;
the browser offers the same preview and recovery. Metadata repairs use native
`set`. Validate again after repair. Imports,
exports and graph mutations remain strict. The browser disables graph editing
while it displays a diagnostic subset; it never saves that subset over the graph.

Analysis requests resolve an explicit `--analysis`, the attached analysis, or a
sole analysis, in that order. Ambiguous/stale targets and repository mismatches
are refused. `--new` explicitly requests a new analysis. Asking for work changes
neither repository nor attachment. `analyze --json` returns request, thread and
comment IDs, dispatch evidence, target and status; repeated active requests reuse
the same receipt. `runs` and `run <request>` are structured reads. No available
worker means a request remains requested; it does not become running by timeout.

Use `run <request> --start` as the actor doing the work. Only that executor may
report `--complete <analysis-item> --revision <reviewed-revision> [--message <text>]`
or `--fail <reason>`. Completion verifies a readable result with the requested
repository. A running status is the executor's report, not proof of a live process.
Inspect the request during work for `cancelRequested`: `--cancel-request` asks
for a stop, and `--cancelled` acknowledges that work stopped. Cancellation cannot
undo external work. `--retry` creates a new receipt linked to a failed/cancelled
attempt. `--dispatch` resumes failed Chat delivery with the existing comment ID.
Choose only one action per invocation.

A direct `/anatomy` Chat message without a request ID is already a work request:
use `analyze --record-only` to record it without dispatching another message,
then claim the returned receipt. Native item versions preserve request history;
reported outcomes and revisions are separate from the concepts' settled status.
