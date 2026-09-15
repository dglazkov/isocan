# Durable design facts and their write boundary

The debt is that a questionnaire currently exists only as a lightly parsed
chat string, and an answer is inferred from whoever speaks next. Phase 0
fixes the following contract before the UI and CLI adopt it. Pure schema and
planning tests establish the representation; phase 1 establishes its live
write boundary. Neither substitutes for the other.

The execution baseline is `304346276dbabd3b7c10dff3f55070dbcff10ab2`.
Existing operations are `thread.create`, `thread.reply`, `comment.update`
and conditional `item.edit`; there is no transactional multi-operation batch.
Do not model one user decision as two unrelated writes and call it atomic.

## Records

All typed records carry `schemaVersion: 1` and a discriminating kind. Validation
is shared and rejects malformed, duplicate or inconsistent IDs, invalid
renderer-specific data and unsupported versions. IDs are generated once for
an intent and reused on retry. A retry with the same ID and different content
is a conflict, not a second accepted answer.

| Record | Representation and identity |
| --- | --- |
| Brief | A versioned JSON item, with request ID and epoch, requesting actor, origin, target/group, intent, delivery type, known facts/assumptions, unresolved decisions, outputs and exact reference/context identities. Progress, fidelity and verification are independent fields. |
| Question set | Immutable typed `design` metadata on a comment. Contains request ID/epoch, question-set ID/revision, intended respondent, headline, inferred answers and renderer-specific questions/options. Its exact source is thread ID, comment ID and payload revision. Reissuing a question produces a new identity and explicitly supersedes the old set. |
| Answer | A new comment with typed `design` metadata referring to the exact question set, request epoch and respondent. Each question has an explicit selected-option, freeform, reference, skipped, dismissed or delegated outcome. Human-readable Markdown is its projection. |
| Reference | Canvas/item/version/blob identity when bytes are available, plus supplied URL and availability where applicable. A filename alone is not a reference. Ordinary selected scope uses the existing retained context manifest; exact typed references additionally retain their identified versions on the comment. Neither introduces another inheritance resolver. |
| Decision | Phase 4 canonical adoption-decision comment beside its comparison, with exact approval basis, compared versions, authorship, authority and adopted output. The phase 0 `designPartner.decision` property remains legacy authored data, never proof of a human preference. |
| Receipt | A versioned JSON record tying results to output/build, context/system and rule/tool/package identities, with check scope, coverage, viewport/states, failures and evidence. It cannot declare quality measured by an offline fixture. |

The implementing core types supply precise field names and limits. Changes to
these meanings require a schema revision or a recorded compatible extension.
Unknown fields that carry future meaning must not be silently treated as
validated current semantics.

The protocol permits up to 32 questions for an explicitly requested interview;
the ordinary workflow has a separate initial budget of zero to three. A
replacement answer retains an explicit resolution for every question the
previous answer resolved. It cannot silently reopen a settled question by
omitting it. An identical accepted retry remains observable after cancellation;
that observation does not authorize a fresh write to the canceled request.

## Actor and request authority

An operation's authenticated actor is the author. A payload cannot choose a
different author. Its respondent must match the intended respondent, and the
writer must resolve actual actor kind as human, agent or unknown. Existing
display logic treating an absent kind as a person is not sufficient evidence
of a human preference. A delegated agent decision remains an agent decision.

At the serialized write boundary, check current request epoch, cancellation,
question source/revision and outstanding resolution, as well as ordinary
canvas permission and actor custody. A typed answer to a superseded question
is refused. An unrelated comment never resolves a question. Undo removes the
answer and derives the question as open again; redo restores the original
authorship and exact typed data through the internal inverse path.

Ordinary prose edits cannot rewrite immutable question/answer metadata. A
question change is an explicit reissue; an answer change is an explicit
superseding answer. The resolver must handle source removal, undo and restore
without treating a dangling answer as authority over another question.

## One answer, one operation

Phase 0's answer planner describes one inner `thread.reply` and its typed
payload. It is a materialization plan, not a claim that the baseline daemon
understands or enforces that payload. The baseline reducer currently drops
unknown fields on a `NewComment`.

Phase 1 therefore introduces refusing wire operations, `questionnaire.ask`
and `questionnaire.answer`, that validate current state and materialize ordinary
comments with their typed metadata. An old daemon must refuse an unknown act,
not accept it and silently lose the answer. The operations share the existing
thread/comment inverse effects and ordinary history/retention semantics.
Only the internal undo/redo path may restore canonical authored records.
Final request/reissue/cancel mappings must preserve this same boundary.

The existing context manifest has one entry per item. It cannot represent two
compared versions of the same item, and resolving its live scope would replace
an older explicit reference with the current version. The writer therefore
fills canonical-only `retainedReferences` on the operation and
`Comment.designReferences`: each entry pairs a `DesignArtifactRef` with its
actual `ItemVersion`, including any visual face. Public writes cannot supply
these fields. Ordinary scope context stays separate. Snapshot, replay,
replication, inverses and blob collection retain these exact versions; reference
reads use them rather than guessing the item's current version.

Legacy `/ask` strings remain readable with strict validation and a conservative
fallback. They acquire no authority from another participant's later message.
Phase 1 defines an explicit adoption into the new protocol when answering an
old question; silently inferring a missing respondent is not a migration.

[questionnaire-protocol.md](questionnaire-protocol.md) records phase 1's concrete
publishing, legacy-adoption and reference-read boundaries. Request creation in
phase 2 removes its temporary need to select an existing valid brief.

## Request lifecycle and evidence

[request-protocol.md](request-protocol.md) resolves phase 2: writer-generated
brief/receipt JSON, canonical version markers, conditional lifecycle acts,
source and answer provenance, permission-bearing context reads and derived
evidence freshness. Its bounded compatible schema extensions preserve old
unadmitted v1 records. Explicit Undo restores prior eligibility only when the
current source/cancellation/context guards hold; it is not permanent worker
revocation.

[systems-and-defaults.md](systems-and-defaults.md) records phase 3’s deliberate
binding widening, decoder negotiation and authored direction semantics.

## One selection, one conditional edit and decision

[comparisons-and-decisions.md](comparisons-and-decisions.md) deliberately
supersedes the phase 0 property representation and its planning-only authority.
`design.decide` materializes exactly one conditional target edit plus one
immutable decision comment, with a dedicated paired Undo/Redo. The brief and
all candidates remain independent. Greenfield adds a fresh version to the
selected screen; existing-screen adoption copies compatible bytes onto the
brief's target. Neither overwrites a brief nor removes rejected options.

Capture target version, title, description, properties and relevant scope
before approval. The writer validates that basis, every option, current
brief/request/source and governing context. Its canonical comment records
actual human choice, actual canvas delegation, honest external reports or
explicit agent judgment as distinct authority branches. Human reasons may be
null; agent rationale cannot stand in for human words. Ordinary later HTML
editing remains legal, and historic choice is separate from current evidence.

`design.compare` publishes and `design.respond` records typed non-adopting
revision/delegation outcomes using the existing comment store. Ordinary
questionnaire answers retain their known-human semantics. Decoder negotiation,
flat evidence retention and exact context continuation are specified in the
phase 4 mechanism; a public property or copied JSON cannot establish authority.

## Entrances and rollout

Keep existing `design` commands and flags compatible. The planned native
verbs are `design ask`, `design answer`, `design questions`, `design start`,
`design brief`, `design workflow`, `design decide` and `design receipt`; each appears in help and
the guide only when its implementation ships. The API exposes the same intents.
Later phases can add bounded options, but cannot create a browser-only act.

One shared canvas property, `design.workflow`, controls automatic enrollment:
absent or `off` preserves the current default; `adaptive-v1` enables the
candidate. Unknown values are reported as unsupported, not treated as on.
An explicit start remains available when automation is off. Only ordinary
authorized canvas edits change this policy. Both summons guidance and external
agents read it; they do not store private rollout settings.

The basic effort limits remain zero to three initial questions, two useful
alternatives when exploration is warranted, and one review plus at most two
repair passes. These are defaults within the person's requested scope and
available execution budget, not authorization for new paid services or studies.
