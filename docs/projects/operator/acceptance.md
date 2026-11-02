# Operator hosted acceptance runbook

Prepared from a3660851 on 13 September 2026. This is an unexecuted hosted runbook. Local readiness was checked on 13 September 2026: 202 focused tests across 19 files passed; this does not close the hosted proof.

## People and surfaces

Use only disposable synthetic acceptance canvases. Have one operator email address approved in the target home's `ISOCAN_OPERATORS`, a different owner email that is not on that list, and a third browser profile as a link-only stranger. The operator proves from a browser on the terminal's machine: the handoff targets 127.0.0.1. Have the owner's phone and laptop, a laptop daemon replicating the canvas, and two independent networks whose external IPv4 /24 prefixes differ. Confirm the chosen refused prefix belongs to the test network and excludes the operator's network.

The ordinary hosted sign-in is an emailed link. Open that link on the machine running the operator command, in its intended profile. Every CLI invocation opens a fresh proof page; it times out after five minutes. Do not save ID tokens, browser handoff URLs, passes or cookies into the proof record.

Before running, a person confirms the deployed build and operator list. Record `isocan --version`, `isocan status`, the Cloud Run revision/image and live relevant settings. Dev follows CI's `green` ref; having code on main or a local green suite is not deployment proof. Production follows the promoted `prod` tag. This runbook performs no deployment or configuration step.

Variables below are deliberately placeholders for ids learned during the walk:

```sh
OP_HOME=https://dev.isocan.io
OP_CANVAS=prj_REPLACE_WITH_DISPOSABLE_CANVAS
OP_OWNER=email:REPLACE_WITH_TEST_OWNER_ADDRESS
OP_SPACE=spc_REPLACE_WITH_DISPOSABLE_SPACE
OP_ACTOR=usr_REPLACE_WITH_DISPOSABLE_ACTOR
OP_NET=net:REPLACE_WITH_TEST_NETWORK_CIDR
```

Do not run the whole file as a script. Owner/stranger/replica commands belong in their respective prepared shell/profile. Give the separate local daemon an isolated `ISOCAN_HOME` and unused `ISOCAN_PORT`; do not reuse the user's ordinary daemon. Owner uses Share to provide a one-use pass, then on the replica machine runs `isocan setup --daemon --no-open '<one-use canvas URL>'`. For a direct-home wait, prepare a different disposable CLI environment with `isocan setup --direct --no-open '<one-use canvas URL>'`. These commands write only those test environments.

## 1. Prove, inspect and expire

The owner creates a synthetic canvas with at least one text item and one small file. Keep the link off initially and leave the operator uninvited.

```sh
isocan operator show "$OP_CANVAS" --home "$OP_HOME"
isocan operator log --home "$OP_HOME" --target "$OP_CANVAS"
```

The page names the exact act before sign-in. Proving the listed address returns maker/counts, link state and **currently relaying** replicas, with no admission and no arbitrary-person roster. Repeat `show`, this time proving the owner's unlisted email; expect nonzero and the proved address in the refusal. Re-read the ledger as the operator: both the successful read and the verified refusal are recorded. `log` itself is recorded too.

Run the following in a disposable shell to prove the session courtesy without starting an rc or spending model tokens:

```sh
ISOCAN_SESSION_ID=ses_synthetic_operator_check isocan operator show "$OP_CANVAS" --home "$OP_HOME"
```

Expect nonzero with the “operator acts need the person” sentence before a browser opens. Actual rc-session proof can use an already-authorized test session; no new rc is required for this runbook.

Freshness caveat: waiting eleven minutes then invoking the CLI only proves it opens a new sign-in, because it always does. To prove server stale-token refusal on the deployment, a person must make an explicit browser-memory-only diagnostic request after retaining one freshly signed token for eleven minutes. Keep the token out of terminal history/files and never send it to an agent. Expect `proof-stale`, with the sign-in age and ten-minute window. This exact server invariant already passed locally with synthetic signed tokens; if the live diagnostic is omitted, record it as omitted rather than claiming the fresh invocation proved expiry.

## 2. Look, take down and lift

```sh
isocan operator look "$OP_CANVAS" --home "$OP_HOME" --reason 'synthetic acceptance report'
```

Expect a read-only deck and no operator presence in the owner's tab. Keep the closed-canvas look open for an hour; after expiry, reload and verify the ordinary stranger refusal. This can overlap the later non-canvas phases; do not grant the operator ordinary access in the meantime.

Next have the owner enable the link, have the third browser open it, prepare the replica, and park the direct-home CLI in a foreground terminal:

```sh
isocan --canvas "$OP_CANVAS" wait --all-ops --timeout 900
```

Then the operator runs:

```sh
isocan operator takedown "$OP_CANVAS" --home "$OP_HOME" --reason spam --note 'synthetic acceptance only'
```

Record before/after timestamps and counts. Expect the third-browser tab's takedown sentence within a second; parked wait exits nonzero with that sentence; owner's list retains the canvas with its reason; replica `isocan status` says taken down at its home and keeps a readable local copy. The replica suppresses rapid retries and retries slowly so a lift can return. Inspect the daemon logs to verify it is not repeatedly hammering the home.

```sh
isocan operator takedown "$OP_CANVAS" --home "$OP_HOME" --lift
isocan operator log --home "$OP_HOME" --target "$OP_CANVAS"
```

Reload the tab/list, check replica sync resumes within the current ten-second retry bound, and inspect both ledger rows. A fresh item added after lift should appear in the replica.

**Content-origin boundary:** dev intentionally has no separate content domain (`infra/config.sh`, `infra/prod.env`). Verify app-origin refusal on dev. The exact `isocan.store` acceptance belongs to a separately approved disposable **production** canvas after promotion, not to a dev canvas or newly provisioned dev domain. Before takedown on that prod canvas, mint two distinct valid signed file URLs: load one to warm the edge and leave one unrequested. Immediately after takedown, the unrequested URL must be refused on its first origin fetch; the warmed URL may remain at the edge only until its printed TTL. Record cache/origin response headers; if they do not establish an origin miss, the origin part is unproved. Do not treat `Cache-Control: no-cache` alone as proof of bypassing the edge. Any optional CDN invalidation is the person executing the printed command with the **explicitly verified `--project`** added (the current CLI line omits it).

## 3. Purge the disposable canvas last

After the lift proof, first attempt purge while it is live; expect nonzero and “take it down first”. Then perform the two intended acts on the disposable canvas:

```sh
isocan operator purge "$OP_CANVAS" --home "$OP_HOME" --force
isocan operator takedown "$OP_CANVAS" --home "$OP_HOME" --reason spam --note 'disposable purge acceptance'
isocan operator purge "$OP_CANVAS" --home "$OP_HOME" --force
isocan operator show "$OP_CANVAS" --home "$OP_HOME"
```

Expect erased counts, seven-day bucket retention, seven-day database rewind, ninety-day export retention and surviving member copies; `show` retains the tombstone and says PURGED. Lift must now fail.

For storage proof, a person with read access uses the actual target project/bucket, explicitly named. Read-only example for the default dev bucket:

```sh
gcloud storage ls --recursive "gs://isocan-io-dev-canvas/canvases/$OP_CANVAS/" --project=isocan-io-dev
```

Record an empty live prefix (a no-matches exit is expected), not an assertion that soft-deleted versions disappeared. In the Firestore console for the same project, inspect `canvases/<id>` and its `ops` and `blobmeta` subcollections: tombstone present, both subcollections empty. Record screenshots with synthetic content only. Inspect live bucket soft-delete, database PITR, backup lifecycle and export schedule against the source defaults before accepting the printed horizons. A hosted adoption attempt must use the same id and a valid synthetic exported log through the existing adoption API; expect refusal and no recreated canvas. The local `packages/server/test/purge.test.ts` demonstrates the exact request shape. If no person runs the valid adoption attempt, leave this acceptance item open.

## 4. End a surface, then an address

Prepare a new disposable canvas and restore the owner's phone/laptop identity sharing. Mint an unused pass from the target laptop; hold it privately. Keep its tab and direct-home wait open. From the phone's **Your surfaces** control, end the laptop surface. Expect tab closure and wait refusal. Attempt the unused pass in the spare profile; it must be refused. The owner's path may subsequently recover quietly as designed.

Prepare fresh disposable target surfaces and unused passes. Then the operator runs:

```sh
isocan operator end "$OP_OWNER" --home "$OP_HOME" --reason harassment
```

The preview lists the exact badges, claims, canvas counts, outstanding passes and enrolments. Review the preview before answering the enrolment question; only include test enrolments when they were deliberately prepared. **The CLI has no final generic confirmation: once the sign-in and any enrolment question complete, the act proceeds.** Expect the same closures, operator sentence, and no silent CLI return as the old actor. A fresh stranger badge may still enter an enabled link. With and without `--with-enrolments` should be recorded as separate prepared cases if enrolment reach is part of the acceptance claim.

## 5. Revoke a canvas link and a space grant

On another disposable canvas with owner and link stranger open:

```sh
isocan operator revoke "$OP_CANVAS" link --home "$OP_HOME" --reason spam
isocan operator log --home "$OP_HOME" --target "$OP_CANVAS"
```

Expect only link-dependent strangers to close as withdrawn, invited members to remain, and owner's Share and `isocan share` to say turned off by the operator with date/reason. Owner runs `isocan --canvas "$OP_CANVAS" share --link on`; this needs no operator proof. Verify it works and adds no **owner action** to the operator ledger.

Repeat a named-address grant case on a disposable space containing two canvases:

```sh
isocan operator revoke "$OP_SPACE" "$OP_OWNER" --home "$OP_HOME" --reason spam --bar
```

Use a different test member from the space's creator as the target. Verify both canvases' access, bar behavior and owner's ordinary unblock/re-invite. A replica addressed as `--home http://127.0.0.1:<replica-port>` must refuse a foreign space operator act with 409 naming the true home; if the replica has no attester/operator at all it fails preflight instead, which does not prove the foreign-home 409 case.

## 6. Refuse and let the clock lift it

```sh
isocan operator refuse "$OP_OWNER" --home "$OP_HOME" --reason harassment
isocan operator refuse "actor:$OP_ACTOR" --home "$OP_HOME" --reason harassment
```

Expect every badge proving the test address ended, and a fresh email proof refused with the contact sentence. A claim resuming the refused actor must be refused by the server. Lift both after observing:

```sh
isocan operator refuse "$OP_OWNER" --home "$OP_HOME" --lift
isocan operator refuse "actor:$OP_ACTOR" --home "$OP_HOME" --lift
isocan operator refuse "$OP_NET" --home "$OP_HOME" --for 10m --reason spam --note 'synthetic mint-flood acceptance'
```

`flood` from the historical journey is not a valid reason category; `spam` is. During the ten minutes, use fresh browser profiles to mint on each network: the test network must show the refusal sentence and the other must succeed. Existing badges are not a mint test. After expiry the test network must mint without a lift. Keep operator access on the unaffected network. `repo:` refusal remains only locally testable until a hosted repo attester exists.

## Record and close

Record build/revision, named person, timestamp, synthetic target ids, expected/actual result, exit code and browser/network evidence for each acceptance item. Screenshots must not capture tokens/passes. Keep skipped items explicitly open. Phase 1–6 records stay PART-DONE until their exact hosted proofs pass. Phase 7 needs reviewed copy, its source guard, the accepted build on production and an observed isocan.io/terms page. Phase 8 remains deferred until a self-hosted home requests it.
