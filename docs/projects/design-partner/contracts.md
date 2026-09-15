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
| Decision | A typed JSON record in the adopted target's `designPartner.decision` property. Includes request/epoch, compared alternatives and versions, selected version, recommendation, reason and deciding actor/kind. The brief and comparison items remain independent of the adoption target. |
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

## One selection, one conditional edit

For an existing screen, the planner emits one `item.edit` containing the
selected compatible content and the decision property together. Both
`expectedVersionId` and `expectedMetadata` protect the adoption target. The
new version is a copy of selected content, with a fresh version identity;
the source candidate and rejected alternatives stay available.

Greenfield selection uses the selected item as the adoption target and adds
a version with the same content plus decision metadata. It does not overwrite
the brief. Existing item-edit inverses restore both version and metadata.

This protects the target, not every input. Phase 4 must additionally validate
the request epoch and source alternative versions at the authoritative write
boundary. A pure planner operating on a supplied snapshot does not enforce
concurrency. A refusing specialized act is required if those guards cannot
be expressed safely by the existing write path.

## Entrances and rollout

Keep existing `design` commands and flags compatible. The planned native
verbs are `design ask`, `design answer`, `design questions`, `design start`,
`design brief`, `design decide` and `design receipt`; each appears in help and
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
