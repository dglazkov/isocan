# Panel origin isolation — 2 November 2026

The previous bridge accepted a content-origin message from the panel window.
Ordinary HTML items shared that origin and could inject a script into the panel,
making the message appear to come from the authorized window. The panel now has
an opaque sandbox origin; its content URL remains unchanged. Its bridge requires
the captured live iframe window as well as the opaque origin. Ref teardown retires
the bridge synchronously, and canvas, panel or source changes remount the iframe.

## Measured proof

`node --import tsx scripts/panel-isolation-proof.mjs` builds the actual production
React panel surface, frame builders and bridge into a synthetic browser page. Two
owned loopback origins stand in for the app and content servers. The content
response uses the production `CONTENT_CSP`; the API returns synthetic credentials
and records operations locally. A new disposable Chrome profile runs behind an
owned proxy that forwards only those two fixture origins and refuses external
destinations. No real canvas, credentials, public service or provider is used.

Before modifying production source, the proof failed against
`4c361084768732499bdb323759922fa0f55d27ac`: an ordinary sibling injected one script
and caused one operation with the panel's synthetic credential. The failure was
the assertion `ordinary sibling acquired panel authority`, not an infrastructure
failure. After repair, the sibling's document access was denied and neither its
injected nor direct message caused an operation. Four legitimate panel messages
succeeded, including after panel, blob and canvas switches; each switch produced
a new WindowProxy. Replies contained only protocol/result fields. Ordinary item
localStorage still worked, while panel localStorage was denied by the browser.

An additional sibling WindowProxy navigation probe attempted both assignment to
the panel's `location` and `location.replace()` with a synthetic malicious content
URL. Both threw `SecurityError`; the server received zero malicious URL loads and
the API received zero unauthorized operations. Legitimate panel messages still
succeeded after the probe. This check is retained in
`isocan-485-isolation-navigation.log` and runs with the same proof command.

The first invocation was blocked by sandbox loopback `EPERM`; the explicitly
scoped browser invocation then received approval. An initial proof-bundle setup
failure was fixed before the negative control. Those setup failures are retained
separately and are not counted as proof of the security defect.

Validation commands:

- `npm test -- packages/core/test/extensions.test.ts packages/web/test/panel-extensions.test.ts`
  passed all 43 tests. Added lifecycle tests retire a bridge during enrollment,
  replace its window during enrollment, and suppress a delayed operation reply.
- `npm run typecheck` passed the workspace and test typechecks. The final web-only
  typecheck checks the ref-callback lifecycle adjustment separately.
- `git diff --check` passed.

Raw logs are retained in the task's sibling `evidence/` directory under
`isocan-485-isolation-before-negative.log`, `isocan-485-isolation-after-final.log`,
`isocan-485-isolation-focused-final.log`, `isocan-485-isolation-typecheck.log`, and
`isocan-485-isolation-web-typecheck-final.log`.

## Limits

Panel origin storage is intentionally unavailable. Restoring it requires dedicated
per-panel origins, not `allow-same-origin` on the shared content origin. The proof
checks browser isolation and the actual bridge against synthetic API responses;
it does not replace server grant tests or a complete hosted integration suite.
Already-dispatched operations are not rolled back by closing a panel; the repair
prevents late enrollment from starting a write and drops results after teardown.
The complete hosted gate remains the conductor's separate checkpoint.
