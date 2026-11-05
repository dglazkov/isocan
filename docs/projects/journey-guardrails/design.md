---
status: partial
since: 2026-11-05
note: "Three phases: bounded browser readiness and CDP, durable interrupted-run evidence, and measured timing assertions. Phases 1–2 CLOSED on a draft branch; phase 3 and final integrated gates are pending."
---

# Journey guardrails

This discharges three harness debts: DOM presence mistaken for usable canvas,
unbounded browser RPC, and failure evidence that exists only after every walk
and its reporting finish.

Readiness observes the application's actual loading surfaces with an explicit
deadline. It neither removes overlays nor bypasses the existing pointer hit
test. The `canvas-finding` loading surface and arrival veil must be observed
separately; their shared effect does not establish a shared cause.

The shared browser helper owns request timers, event waits and socket lifecycle.
A timeout names the operation; a closed connection rejects pending work. A
deadline must cover one hung call, not just the interval between polling calls.

The journey runner checkpoints structured progress atomically at each boundary,
including which journey is active and whether all selected journeys completed.
The workflow streams its log to disk and records failure before any network
comment. Its walk and reporting budgets fit inside the overall job budget, with
headroom for setup and diagnostics. Missing or incomplete evidence is failure,
and diagnostic upload/commenting uses failure-aware conditions.

Timing is measured at the event being asserted, in the browser's own clock when
possible. Host polling and fixed sleeps cannot establish animation elapsed time.
Any changed measurement must preserve the product's bound and demonstrate what
was wrong with the old measurement; otherwise retain the failure as open.
