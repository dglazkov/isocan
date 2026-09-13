# Competition integration proof — 13 September 2026

The implementation proposed in PR #264 is integrated with the current groups
model. These are local technical proofs. They do not replace phase 0's human
distinctiveness and cost measurement or the hosted bout with real fighters.

## The structural boundary

The real CLI bout test creates three lanes on a groups canvas in one
`group.change`, undoes the whole arena, and restores its explicit membership.
A malformed prepared forest receives HTTP 400 without changing the snapshot
or log. Nested scope, legacy geometry, scoped design lookup, curtain and
hand-in share core's canvas scope. The terminal uses the same ballot tally as
the web. Self-ranking is refused and excluded by the derived tally.

The fixture casts actual registry identities and sends real operations over
HTTP, but supplies synthetic HTML entries itself. It proves the workflow's
mechanics, not designer quality or a real model run.

The conductor separately ran `design --css` for the root and each of two
lanes: all three outputs differed, and the root's synthetic token appeared
only in the root output. After `session start`, a real CLI process parked with
`wait --in "Road Signs" --op "thread.*"`. An unaddressed comment pinned to the
other lane did not wake it; the following comment in its lane returned that
comment alone, exit 0. Direct summons still pierce filters by design.

Reproduce the checked-in boundary and workflow proofs with:

```
npx vitest run packages/modules/design-competition/test packages/cli/test/rc-records.test.ts packages/cli/test/rc.test.ts
```

## Browser and deferred loading

The conductor drove a fresh Chrome profile against a scratch daemon. The
initial canvas loaded no competition code or CSS. Typing
`/design-competition Acme Chat brief` in Chat opened the picker with that
brief and left the canvas sequence unchanged at 1. The keyboard palette
opened the same picker. Actual pointer input selected three fighters and
laid four explicit groups with three fighter cards; the arena was framed in
the viewport. Browser exceptions: none.

The entry bundle remains below the unchanged 734,200-byte ceiling. Moving
the existing print route and exporter behind lazy imports recovered enough
space for the generic module hosts. The conductor therefore also walked the
print route: two HTML slides became two print sheets, a 3,214-byte standalone
HTML export, and a 23,188-byte PDF. `pdfinfo` confirmed two 960 × 540 pt pages.

The browser harness initially left its own Chrome child alive after all
assertions and daemon cleanup. A scratch harness that closes both CDP sockets
and bounds Chrome shutdown repeated the Chat, picker and print proofs and
exited 0. No product behavior was changed for harness teardown.

## Configuration before publication

Enrolment prepares the working directory and rc row before publishing
`agent.enroll`. A watching rc therefore observes a ready directory. Rc file
writes share a cross-process lock and atomic rename. A preparation token
permits rollback only while that attempt still owns the row; a concurrent
update wins. A lost response after remote acceptance keeps the prepared row.

Tests include actual dropped HTTP responses after engine acceptance,
concurrent rc writes, missing parent directories, and conditional rollback.
The lock times out visibly rather than stealing a possibly live writer's
lock. There is no silent repair of a stranded lock.

## Remove and restore

In an isolated clone of the integrated source, the conductor:

1. Built the runtime module with `node --import tsx scripts/module-build.mjs
   design-competition --out ../integration-runtime`.
2. Created three synthetic finished arenas: 30 items and 16 canvas operations.
3. Removed the module directory, its entries in both lists, and its Dockerfile
   manifest line, then ran `npm run build` successfully.
4. Started the resulting daemon. CLI help had no competition command; the
   arena's ordinary files and reactions remained. In the real browser the
   palette action and all specialized fighter cards were absent.
5. Installed the saved runtime build with `isocan module add
   ../integration-runtime --yes --proposed`. The command and palette action
   returned and six fighter cards rendered. Browser exceptions: none.

The complete canvas snapshot was identical before removal and after
restoration. The operation log digest remained
`ab4f39bb371730c840a05b4e67f14935a29f6063715365267305264c3b50d37b`
at every checkpoint. The probe restored the source and rebuilt it during
cleanup, then exited 0.

This was a source/runtime proof, not a container-image proof. Docker Desktop
requires local administrator setup before its engine can run here; no image
build or hosted deployment is claimed.

## Surface accounting

- **Operations:** existing primitives and the bounded group vocabulary;
  prepared creation is one undo, and both clients use the same intent.
- **CLI:** competition verbs, scoped design/wait and module/template helpers.
- **Agent guide:** the module's guide and the existing quick-reference guard
  cover its registered verbs.
- **Shared core:** scope, arena preparation, packs, contributions, rounds and
  ballot/standings derivation.
- **README:** names the available exhibition workflow and its remaining gates.
- **Tests:** reducer/CLI/API/rc guards plus the actual browser and removal walks
  above. Real fighters, human comparison, hosted voting and image removal
  remain the named phase acceptances.
