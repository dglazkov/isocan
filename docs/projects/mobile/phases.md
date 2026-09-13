# Mobile — the walk

The staged design is the [mobile research](../../research/2026-09-05-mobile-web.md).
The journeys here turn its first three stages into reviewable proofs. There
is no new operation; gestures reach the intents both clients already share.

**Where we are:** phases 0–2 are technically built and pass independent browser
touch walks for controls, Chat-first navigation, reference cards, the
authoritative prior-visit digest and presentation.
The node-walk revision from `origin/main` was incorporated before building.
Physical-phone keyboard, Safari and gesture acceptance remain named hands;
handoff and install/share targets remain later stages.

## Phase 0 — Finish touch controls

**Status: PART-DONE.** 2026-09-13 — touch menus, rail folding and 44px primary controls pass the actual browser proof; gesture feel still needs a physical phone.

**Proof:** journey 2 in a built browser with touch input. Measure bounds at
375×812, tablet width and a narrow mouse window. Assert one/two-finger
transforms, cancelled long presses and no preference changes on resize. Run
the full suite and typecheck. Judge gesture feel on an actual phone.

**Verification:** the conductor ran `MOBILE_PROOF_DIR=/tmp/isocan-finish-mobile0-root-screens
node scripts/mobile-journeys.mjs` on the integrated build, exit 0. Actual CDP
touch proved pan, pinch, stationary hold and cancellation, tablet input,
narrow-window mouse selection, and preservation of the saved minimap choice.
The module's tools are lazy so the entry ceiling stays unchanged.

## Phase 1 — Chat first, with the work one tab away

**Status: PART-DONE.** 2026-09-13 — Chat, spatial navigation, conversations,
the prior-visit digest, reference cards and desktop restoration pass the
integrated browser walks. Physical-phone acceptance remains; general causal
output provenance is separately scoped work.

**Proof:** journey 1 on a synthetic canvas through the real browser. Submit
Chat through the UI and inspect its daemon record; walk live/dead node edges,
open the node thread, pinch out to the marked plan and open an agent stage
from the roster. Prove digest rows against a prior seen-mark and Chat cards
against real request/output relationships. Repeat with a read admission.
Resize both ways without losing desktop preferences or a Chat draft. Run
the full suite and typecheck; check the composer with a real phone keyboard.

**Verification:** the conductor ran the checked-in touch journey against the
combined navigation/mobile build, exit 0. Chat submission reached the daemon;
the same unsent draft survived tabs and width changes. Live/dead edges, the
marked plan, agent stages, read-only conversations, digest item/thread links
and addressed thread arrivals were exercised. The saved desktop panel and
minimap choices survived the resize.

The combined build initially put Inbox over Submit. A reserved header slot
now leaves both reachable. A separate actual-browser palette walk covers
Chat, node, plan and Agents, keyboard canvas switching and desktop Context
after resize. Phone and covered views offer navigation only; attempting
hidden panel commands changes neither saved preferences nor the operation log.

A separate actual-browser card walk opened explicit references and eligible
saved request roots through real touch input. Current previews are labelled;
saved manifests and their original bytes stayed identical. Deleted, excluded,
unavailable and expanded descendants supplied no card or speculative fetch.
The targeted prior-read guards also prove that a legacy local mark of 99
cannot replace the home's answer of 5 or its explicit absence of a mark.

## Phase 2 — Present by touch

**Status: PART-DONE.** 2026-09-13 — viewer/fullscreen gestures, Notes, exit
and the print route pass the conductor's actual browser walk. The same walk
on a physical phone remains.

**Proof:** journey 3 in both viewer and fullscreen. Tap and swipe forward
and back, try the boundaries, vertical movement and interactive controls,
open/close Notes and exit. Check the printable deck route. Run the full
suite and typecheck, then the same walk on a real phone.

**Verification:** `MOBILE_PROOF_DIR=/tmp/isocan-finish-stage2-root-screens
node scripts/mobile-journeys.mjs` exited 0 on the integrated build. Both
FullScreen and Viewer passed tap thirds, the first boundary and exactly one
advance per swipe across a three-slide fixture. Vertical text scrolling and
an actual embedded-page button kept their own input. Notes closed on the
same slide without changing desktop preferences; Back exited; the print
route produced three sheets. The conductor inspected the screenshots.

The final replay after the hook-stability fix used
`MOBILE_PROOF_DIR=/tmp/isocan-finish-final-green-mobile-screens node
scripts/mobile-journeys.mjs`, exit 0. It repeated phases 0–2 on the final
integrated source, including current route callbacks after each gesture.

## Later stages

Stage 3 handoff and stage 4 install/share targets keep the research's order
and are outside this continuation. A native app remains refused.

## Surface accounting

No operation or CLI verb was added for local navigation and gestures. Chat
and item conversations use the existing comment operations and CLI verbs;
presentation retains the shared deck order, item routes and note contents.
Private visit marks remain outside the operation log. The existing agent
guide therefore needs no new quick-reference entry. README describes the
phone face and touch presentation. Pure gesture, scope and digest logic has
focused guards; actual browser input supplies the interaction evidence above.

## Trajectory

- **2026-09-13** — `origin/main` added the node walk while this continuation
  was being briefed. Chat-first remains settled; the Canvas tab inherits the
  desktop's spatial neighbor rule and stepping remains local navigation.
  Group-first ordering and making the walk the primary face remain separate
  product choices, so this build changes neither by implication.
- **2026-09-13** — Open: physical-phone keyboard behavior, Safari toolbar
  changes and gesture feel need a phone. Desktop touch emulation is useful
  evidence about events and layout, and cannot close those observations.
