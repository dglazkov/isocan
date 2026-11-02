# Operator terms proposal for Dion

Prepared 13 September 2026 from local source at a3660851. This is a review draft. No live terms, deployment, configuration, or account was changed. The operator implementation exists on main and passed local checks; the hosted acceptance below has not happened in this session. Publish the final wording only after the named home runs the accepted build and its operator configuration is confirmed.

## Proposed final text

Replace only the third paragraph of **Two ledgers, and the line between them** with:

> The desk's ledgers — badges, the claims saying who may speak as which actor, attestations (which means email addresses), grants, provenance, and the record of operator acts — are private to the home and are never replicated to clients. An operator act records who proved they could act, when, what they asked for, their reason and note, and the outcome. The operator can read that record. The affected person reads the explanation on the surface where the act reaches them; the operator's note stays private.

Replace **Abuse, and taking things down** with these paragraphs:

> The operator can inspect a reported canvas, take it down so this home stops serving it, end a surface's recognition, turn off a grant, and refuse a proven address, an actor's name, or new badges from a network. Each operator request requires a recent sign-in by an address named in this home's configuration. Verified requests, including refusals, are recorded in the home's private operator ledger.

> Looking opens the reported canvas read-only for an hour. The look is recorded, but people on the canvas are not told that the operator arrived. Taking a canvas down closes its live connections at this home and shows the date, reason, and address to write to. It leaves copies on members' machines where they are. It can be lifted. Content already cached at the edge may remain available for up to five minutes.

> Erasing what this home holds is a separate act, possible only after taking the canvas down. The purge removes the canvas's files and operation log from the live store. The record of the canvas and the operator's acts remains, and the canvas's id cannot be used again at this home. The storage bucket retains deleted objects for seven days, the database can be rewound seven days, and nightly database exports can retain operation text for up to ninety days. Copies on members' machines are theirs; this home cannot erase them.

> Ending a surface closes its connections and ends its outstanding passes. It does not stop the person returning as a stranger. Turning off a grant removes access that depends on it, and the owner can turn it back on. A refusal of a proven address ends surfaces that proved it and prevents proving that address again while the refusal is in force. Network refusals prevent new badges from that network and expire. A stranger who proves nothing and enters by a link cannot be refused by who they are; the operator can turn the link off or take the canvas down.

> Write to dimitri@glazkov.com. Say which canvas and what is on it. Content that is illegal, or that exists to hurt somebody, comes down. There is no appeals process, because there is no process — there is one person reading the mail, and he will tell you what he did.

The last paragraph is existing copy retained for review, not a new policy recommendation. Preserve the existing named-operator section unless Dimitri changes the operator roster/contact decision.

## Conditions and source anchors

- Ledger: `docs/projects/operator/design.md`, “The record”; actual types and requests in `packages/core/src/operator.ts`, `packages/server/src/http.ts`, and both desk implementations. Invalid/unverifiable tokens do not produce a verified-person record; the wording deliberately says verified requests.
- Look and takedown: design “The look” and “Take a canvas down”; `packages/core/src/takedown.ts`, `packages/server/test/takedown.test.ts`. A look's existing admission may be superseded by a separate ordinary admission; test the closed-canvas case.
- Purge horizons: design “Purge: the bytes”; `packages/cloudstore/src/purge-horizons.ts`, `infra/20-firestore.sh`, `infra/30-bucket.sh`, `infra/90-backup-export.sh`. These are configured code defaults, not a read of today's live resources. Confirm deployed settings before publishing the numbers. Ninety-day expiry is governed by storage lifecycle processing; do not promise a timed physical-erasure deadline tighter than the provider's actual lifecycle behavior.
- End/revoke/refuse: design's corresponding sections; `packages/server/test/operator-end.test.ts`, `operator-revoke.test.ts`, `operator-refuse.test.ts`. Network refusal gates minting, not every request from an already admitted badge. Enrolments survive an end unless deliberately included.
- Default five-minute content TTL: `contentTtl` and `cdnPurgeFor` in the server. The configured `ISOCAN_CONTENT_TTL` can change it; match the deployed home before publication.

When applying, extend `TermsSection.sources` to carry an explicit source document plus quote, keeping existing sections bound to `innkeeper.md` and binding operator-specific claims to `operator/design.md`. Update `terms.test.ts` to read each named document and fail if a cited sentence disappears. Continue to verify rendered paragraphs, named operator/contact, and no invented company. This scratch proposal does not implement that test change.

## Phase 0 reconciliation and smallest decisions

Phase 0 was an interim proposal, never applied. Its “first three are done by hand” and “fourth is not built” wording is now stale against source. Do not publish it as today's implementation status. When final wording is accepted, explicitly retire phase 0 as superseded by phase 7; neither is complete merely because a draft exists. Phase 7 remains pending hosted acceptance and publication on isocan.io.

The two decisions needed are (1) Dimitri's operator address list and contact for the target home, and (2) Dion's approval of final public wording, including the disclosed look, replica boundary and retention horizons. Proposed journey correction: use the existing emailed sign-in link; adding Google OAuth is not needed to accept the implemented workflow. No public count is proposed because no public-count mechanism is built.

Adjacent copy finding: `RE_HOMING_NOT_YET` still claims the one-command move is unbuilt, while `isocan teleport` exists. Retire that separate caveat only after checking its own phase/deployment proof; it is outside this operator draft.
