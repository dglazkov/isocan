# Exact phase 0's probes

The three facts in [`../phases.md`](../phases.md) Phase 0 were answered by
running these, not by reading Exact's source. They are records, not tests:
each needs a real Exact checkout, a fixture app made with `exact new`, and
(fact 1) a scratch isocan daemon on :4443 with its content origin on :4444.
Run from an unbound scratch directory, never inside a bound repo.

| Probe | Question | Run (from the repo root) |
| --- | --- | --- |
| `fact1.mjs` | Which live-frame door loads inside isocan's two ancestors? | `node docs/projects/exact/probes/fact1.mjs <app> <out> <isocan-bin> <canvas>` |
| `fact2.mjs` | Does Exact's resident agent session survive a rebuild? | `EXACT=<checkout> bun docs/projects/exact/probes/fact2.mjs <app> 47821 <out>` |
| `fact3.mjs` | Does a held Tamber proposal render without being accepted? | `EXACT=<checkout> bun docs/projects/exact/probes/fact3.mjs <app> 47831 <out>` |
| `pixels.mjs` | Are two PNG captures pixel-identical? | `node docs/projects/exact/probes/pixels.mjs <a.png> <b.png>` |

Exact commit when they ran: `0104e402` (plus one local deploy fix,
expo/exact#555), 13 Nov 2026.
