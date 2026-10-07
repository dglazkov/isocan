---
status: partial
since: 2026-10-07
see: judge, voice-agent, wireframes, evals, copy-edit, mobile, keys
note: specified 6 Oct 2026; phase 0 PART-DONE 7 Oct 2026. A fourth backing for the judge seam, beside Jev, stub and home, that runs EmbeddingGemma 2 (text, 270M, 165 MB) in the person's browser through MediaPipe's Decision Maker, behind an experiment. It triages and never rules. Built: `isocan model fetch` and `model ls`, a loopback-only `/models` route on the local daemon, a Worker behind a browser-enforced `connect-src 'self'` policy (MediaPipe posts telemetry to Google, and the policy blocks it), and a lab page. On an M3 Max the median answer is 33–35 ms up to 128 tokens, inside the bar Dion set (warm median: 100 ms desktop, 250 ms phone), with p95 at 170–200 ms from unexplained streaks reported beside it. The phone's half is a walk; phase 1, the offline three-judge comparison, is next.
---

# The judge in the tab

This is the **ideal**: what it feels like when a small model lives in the
browser beside the canvas and makes the routine calls that today either cost a
round trip to a paid model or are not made at all. The mechanism is
[`design.md`](design.md); the use cases, ranked, are
[`ideas.md`](ideas.md); the walk is [`phases.md`](phases.md).

The scenes are synthetic. Acme is a made-up shop.

---

## Scene 1 — "Make it better"

Priya selects Acme's checkout screen and types into the Chat:

> make it better

Before she presses Enter, a quiet line forms under the composer: *Better how?
Tighter spacing · A different layout · Three variations.* Nothing was sent to
anyone. The line is a guess about her intent that came back in under a
tenth of a second, and it is a guess that says it is unsure — so it offers
choices rather than a command.

She taps *Three variations*. The composer now reads `/variation 3` with her words
underneath, and she sends it. One comment, attributed to her, exactly what she
would have typed if she had known the command existed.

**What the scene forces:** a local judge that can say *I don't know* and shape
the doubt into a clarifying question; a suggestion that becomes the person's
own act only when they take it; and no new kind of comment.

## Scene 2 — "Find the onboarding one"

Ravi presses ⌘K on a canvas with two hundred items and types *the screen where
people pick a plan*. No item is titled that. Today the palette finds canvases
and commands, not items, and anything it did find would need the words to
match.

The palette shows three items under **On this canvas**: *Pricing — tiers*,
*Checkout step 2*, *Upgrade modal*, in that order, each with a faint bar for
how close it is. He picks the first and the viewport glides there.

When Ravi's laptop is offline on a train, the same search still works: the
index was built in his browser from items he can already read, and it never
left it.

**What the scene forces:** retrieval by meaning over the items a person can
already see; an index that is per-browser, deletable and never sent to the
home; and a search that still works without a network.

## Scene 3 — The fast path without the round trip

Priya is talking to the canvas. *Put the receipt under the checkout.* Today
the fast path asks Jev on the home — five typed questions about the utterance
— and the act lands when the answer comes back across the network. With the
judge in the tab, the same five questions are answered locally. The move
lands while she is still finishing the sentence, and the live model's own
call, arriving a moment later, agrees with it and is dropped.

When the local judge is unsure — *put it somewhere nice* — it says so, the
fast path escalates exactly as it does today, and the live model answers.

**What the scene forces:** the local judge answers the questions the fast path
already asks, in the shape it already reads, and is held to the thresholds
the fast path already measured — not to new ones chosen by hope.

## Scene 4 — Who should take this?

A main-thread comment arrives with no @mention: *can someone check the
contrast on the dark theme?* Three agents are enrolled on the canvas: a
builder, a copy editor and a design auditor. None of them wakes, because
nothing addressed them — the wake rule is deterministic and stays so.

Under the comment, the person who wrote it sees a chip: *Ask @Auditor?* They
tap it, the comment gains the mention, and the auditor wakes through the
ordinary rule. The judge suggested who; the mention decided.

**What the scene forces:** the wake rule is never handed to a model. A local
judge may propose an address; only a person's act adds it.

## Scene 5 — The browser that refused

Kit opens the same canvas on an old laptop with no WebGPU and four gigabytes
of memory. The judge-in-the-tab switch says, in words, that this browser
cannot run it well and why, and offers to keep using the home's judge. Nothing
downloads. Every scene above still works the way it does today, slower or not
at all, and nothing is broken.

**What the scene forces:** the feature is an addition that can be absent. It
downloads only when somebody asks, it measures before it promises, and its
absence is the product as it is today.

---

## What the scenes force

The load-bearing minimum, which is what to read before building anything here:

1. **One more backing for the existing seam, not a new seam.** The judge
   project's `Answerer` already has `jev`, `stub` and `home`. This adds
   `local`, answering the same choice questions with the same full
   distribution.
2. **The judge triages; it never rules.** Between every answer and every
   change sits a deterministic policy layer and an act a person (or an
   existing guard) accepts. No new `Operation`.
3. **Abstaining is a feature.** Thresholds come from a calibration split, by
   the fast path's existing rule, frozen before a locked test.
4. **Nothing leaves the tab.** Requests, context, embeddings and answers stay
   in the browser; an index of items is sensitive data, stored per browser
   and deletable. Proved with the network off, not asserted.
5. **Absent by default.** Behind an experiment, lazy, outside the entry
   chunk, and a browser that cannot run it is told so in words.
