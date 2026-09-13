# Public — a catalogue beside the working list

This discharges #292's discovery request after hosted-sharing deliberately
stopped treating every link-open canvas as an advertised canvas. Reopening
the ordinary listing would also subscribe Inbox and agents to strangers'
work. A separate catalogue advertises only an owner's explicit selection.

## One decision on one link

Extend the shared grant record with an optional latest listing decision:
`{ listed: boolean, at: string, by: string }`. Attribution uses the acting
badge id, as existing grant and revocation records do; it does not claim that
a badge id is a person's name. Missing, malformed and unknown records are
unlisted. Only a live canvas-scoped `link` grant at `read` or `view` is eligible.

A dedicated owner-only API receives the concrete grant id and a boolean.
The Desk mutation validates eligibility and stamps the decision atomically.
A stale read followed by `putGrant({...oldRow})` is forbidden: it can replace
a concurrent revocation with a live row. FileDesk queues and journals the
mutation; CloudDesk transacts it and round-trips the nested record explicitly.
Revoke clears publication in the same write. Replacement grants begin unlisted.

Unlisting changes no admission, link capability or canvas operation. A normal
grant change keeps its existing sweep. An ineligible or revoked grant never
advertises, even if a damaged record retained an old true flag. Takedown and
deletion are checked when reading the catalogue. Lifting a takedown restores
an otherwise unchanged listing; changing or revoking its link does not.

The issue's proposed oplog requirement conflicts with the established
two-ledger boundary: sharing is a daemon API act held by the home, never a
replicated canvas Operation. This design retains that boundary. FileDesk's
journal and CloudDesk's current row differ; this is a latest decision, not a
new cross-backing audit-history promise.

## A narrow catalogue

A new catalogue route returns only canvas id, title, canonical home/entry
address and `read`/`view` capability. It excludes snapshots, thumbnails,
item counts, activity, owner contacts, agents, comments, grants and spaces.
The writer rechecks current link eligibility, authoritative local ownership,
live canvas state, takedown/purge and applicable refusal rules. An aggregate
route does not inherit the ordinary per-canvas hooks automatically.

Catalogue reads never admit, mark seen, read blobs or trigger replication.
The current working-canvas discovery route is unchanged. Candidate lookup is
a Desk query over listed grants, with final validation at the home, rather
than a scan and snapshot of every canvas. Public metadata responses are not
cached as a durable source of listing truth.

The catalogue is on the home being queried. CLI supports an explicit home
address for browsing a hosted home from a replica; default browsing means
the connected daemon's own catalogue. A remote mutation follows the existing
authenticated home connection, with no local success before the home answers.
A person who entered through a read link and subsequently redeems an owner
pass must regain that owner standing before generic write gating. Admission
is idempotent only when the incoming credential does not prove a higher rung;
a pass upgrades a weaker ordinary admission and preserves a stronger one. An
active operator look remains a ceiling until it ends. Unknown routes on older homes
fail visibly. The exact public page is exempt
from a pure replica's page signpost. Existing built static files are served
before page redirects so that this local catalogue can actually boot; other
pages retain their home redirects.

## Both surfaces

`isocan share --public on|off` is a separate act, requiring a current link.
It rejects spaces and combinations with other sharing mutations before any
write. `isocan canvas list --public` (with an explicit `--home` when wanted)
uses the catalogue DTO even from a bound project directory; it does not read
ordinary canvas rows, bindings, actor names or space membership first.
Sharing output shows publication separately from the capability column.

Share exposes **Public on this home** only with ownership and an eligible
link. Changing access never implicitly publishes. The named home shows a
Public section with plain rows, not the existing preview-fetching cards.
The unsigned FrontPage provides a clear entry to an identity-independent
`/public` page; visiting it creates no actor. The same lazy catalogue view
serves both places. Loading, empty and error states remain distinct.

Public pages and catalogue API responses carry noindex/nofollow headers;
canvas entry HTML carries noindex as well. The ordinary unsigned marketing
front page need not become a catalogue of titles. No indexability selector,
Open Graph thumbnail or automatic screenshot is introduced.

Personal memory must be born without any link or publication grant. This
project does not infer publication from an item, title, memory link or project
property; later personal-memory policy must be enforced by trusted home data.
