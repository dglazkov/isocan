# Questions retain their source and their answer

The debt is that a lightly parsed chat message can be closed by unrelated
traffic, and its attached filenames do not preserve anything an agent can
read. This mechanism implements design-partner phase 1 on the phase 0
[contracts](contracts.md). It is an implementation decision until that phase's
real browser/CLI proof closes.

Publishing uses canonical `questionnaire.ask` with an existing thread,
comment ID and validated `DesignQuestionSet`. Answering uses canonical
`questionnaire.answer` with the same thread, a fresh stable comment ID and
the validated `DesignResponse`. Both remain recognizable operations in the
log; their reducer effect is an ordinary authored comment with immutable
typed design metadata and shared readable Markdown. Ordinary comment writes
cannot smuggle these records. Undo and redo preserve the original author,
typed payload and retained references through the internal inverse path.

The serialized writer reads the identified current brief, checks request and
epoch, validates the source question and respondent, and resolves references.
It derives actor kind from the actual registry and canonical joins. The
existing display map lists agents only; an absent entry never establishes a
human. A bounded read exposes actor ID, name and resolved human/agent/unknown
classification for the browser's respondent picker and equivalent CLI use.
It does not expose private registry credentials or harness-session keys.

Shared question-state reads report the question's exact source, author,
responses, effective resolutions, outstanding IDs and current status. A
changed brief, removed source or superseding question makes fresh answers
stale. Accepted responses remain history. Unrelated prose and other agents'
updates do not resolve a typed question, including its blocked/asked standing.

Phase 1 requires an existing valid brief and thread for publishing. The web
producer selects that brief and an explicit recipient using labeled controls;
the CLI takes the same identified records. Phase 2 supplies the natural
request-start path. This is a temporary bootstrap boundary, not a new mandatory
specification approval step in the intended ordinary design flow.

Legacy `/ask` messages use strict shared parsing. Invalid content remains
readable prose. Adopting a valid old questionnaire is an explicit publishing
action with an identified brief, named recipient and the exact original
thread/comment/body. The writer checks that source is unchanged and the
normalized questions are equivalent. A later comment never supplies an
inferred respondent or implied answer. The original message remains history.

Ordinary selected context and exact references have different cardinality.
The writer keeps the ordinary context manifest, and separately materializes
canonical-only retained reference/version pairs on the comment. This preserves
two versions of one item and their visual faces. A phase 1 reference artifact
must be a readable actual version at this canvas's authoritative home.
Cross-home references are explicitly refused until brought through an existing
authorized copy/pin path; later governing-context work must preserve permitted
inherited provenance without treating this temporary restriction as a new
inheritance policy. A supplied URL is not a fetched artifact.

A superseding answer may keep an exact version already canonically retained
by that question's source or response history after the live source was pruned.
The writer still verifies the authoritative home, canvas and available bytes;
the caller cannot supply replacement version metadata. Changing a text answer
must not require reuploading an unchanged reference that remains readable.

Feature negotiation follows the original client through a home relay. The
relay's decoder capability does not establish the caller's capability, and an
operation-ID retry is checked against the actual receipt being returned. A
relay identity claim likewise supplies custody transport, not a human/agent
classification; existing recorded harness provenance must survive it.

`design ask`, `design answer` and `design questions` expose the same acts and
states. `design reference` reads exact retained bytes, including after a newer
version becomes current. These commands are advertised in the shipped help
and agent guide only when implemented. The shared browser-safe API provides
the same records and read checks; the Node adapter does not define private
semantics.

Unsubmitted browser drafts belong to the local actor/canvas/source. They keep
separate choices, freeform text, URLs and upload attempts per question. Uploaded
file bytes persist locally in IndexedDB until a retrievable reference is
acknowledged, so an interrupted upload can actually retry after refresh.
Quota or storage failures remain visible. Stable upload, operation and response
IDs survive uncertain receipts. Queued or refused writes never look complete.
The implementation reuses existing group-placement and operation-receipt rules.

A submission result distinguishes the caller's stable `submittedOpId` from
the accepted `opId`. A direct canonical receipt supplies the latter, including
the original ID when the writer recognizes the same saved payload under a
new delivery ID. After a lost acknowledgement, an authoritative snapshot can
confirm the exact saved comment, payload and author; it cannot identify the
operation that wrote them. That recovery says `confirmedBy: snapshot` and
`opId: null`, while retaining the submitted retry ID. Accepted author matching
uses the home’s current canonical joins without rewriting historical authors.
