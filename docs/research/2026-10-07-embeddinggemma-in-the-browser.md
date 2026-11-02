---
status: noted
since: 2026-10-07
see: local-judge, judge, voice-agent
note: "local-judge phase 0's measurement of EmbeddingGemma 2 Text 270M through MediaPipe Decision Maker 1.1.0 in a Web Worker, on an M3 Max running Chrome 154 on Darwin 27, with the model served by the local daemon. The median answer takes 33-35 ms up to 128 tokens on WebGPU, but warm p95 is 170-200 ms in most runs, from intermittent streaks of slow answers whose cause is not established, and 570-810 ms at 512 tokens over long runs. Dion then moved the phase's bar from p95 to the warm median, which the desktop passes up to 128 tokens. CPU is about 25 times slower. The runtime posts metrics to odml.pa.googleapis.com, and a Content-Security-Policy now blocks it in the browser. Loading the model adds 1.2-1.7 GB of resident memory. The privacy proof held: offline, every request went to the daemon. On an iPhone 17 Pro (iOS 27.0.1, Chrome for iOS, so WebKit's WebGPU) the median was 32-42 ms up to 128 tokens and 142-179 ms at 512, with no streaks — which points the desktop tail at Chrome's WebGPU on macOS."
---

# EmbeddingGemma in the browser, measured

**7 October 2026.** This is [local-judge](../projects/local-judge/phases.md)
phase 0's measurement. The project asks whether a small embedding model can
make routine decisions inside the person's browser fast enough, and privately
enough, to be worth building on. These are the numbers that answer the first
half on one desktop. The phone was a person's walk,
[`docs/verify/2026-10-07-local-judge-on-a-phone.md`](../verify/2026-10-07-local-judge-on-a-phone.md),
and its numbers are under *Phone* below.

## What was measured

| | |
| --- | --- |
| Machine | Mac15,10, Apple M3 Max, 14 cores, 36 GB, Darwin 27.0.0 |
| Browser | Chrome 154.0.8037.98, headless and headed; WebGPU adapter `apple metal-3` |
| Model | `embeddinggemma-2-text-270m.litertlm`, 164,626,432 bytes, SHA-256 `2d079ee2…86fb` (litert-community, Apache-2.0) |
| Runtime | `@mediapipe/tasks-decision` 1.1.0, in a dedicated Worker |
| Served by | a scratch local daemon on 127.0.0.1:4443, `GET /models/<name>` |
| Question | one Choice question; 7 or 30 options; state of about 32, 128 or 512 tokens |
| Driver | `scripts/local-judge-measure.mjs`, Chrome over CDP, outbound network unavailable (`--host-resolver-rules` maps everything but 127.0.0.1 away) |

The token counts are the model's own (`measureContextUsage`). The question
adds 106 tokens with 7 options and 365 with 30, so "32 tokens" means 137 or
396 in total.

## Readiness

| | GPU, cold | GPU, model from Cache Storage | CPU |
| --- | --- | --- | --- |
| Download (loopback) | 164.6 MB in 0.4–0.5 s | from cache | from cache |
| Load | 67–91 ms | 47 ms | 67 ms |
| Compile | 1.4–1.8 s | 1.3 s | 1.8 s |
| Prewarm | 0.3–1.5 s | 1.1 s | 10.9 s |
| First answer | 33–161 ms | 92 ms | 1.3 s |

Headed runs were slower to download: 3.0 s in one run and 63.8 s in another
over the same loopback. That is not explained, and is not the number to quote.

## Warm answers, GPU

Milliseconds, measured from the page's request to its answer (`roundTrip`).
Four runs: two headless at n=1,000 (the builder's, then a reload of the same
page), the conductor's own headless at n=1,000, and one headed at n=50.

| Options | Tokens | Run A n=1,000 p50 / p95 | Reload n=1,000 p50 / p95 | Conductor n=1,000 p50 / p95 | Headed n=50 p50 / p95 |
| --- | --- | --- | --- | --- | --- |
| 7 | 32 | 33.6 / 189 | 80.3 / 171 | 33.4 / 190 | 161 / 183 |
| 7 | 128 | 33.8 / 176 | 33.7 / 177 | 33.8 / 173 | 35.1 / 150 |
| 7 | 512 | 134 / 666 | 136 / 809 | 147 / 583 | 131 / 133 |
| 30 | 32 | 33.5 / 33.8 | 33.9 / 199 | 34.3 / 178 | 32.8 / 33.3 |
| 30 | 128 | 33.7 / 34.0 | 33.7 / 34.6 | 35.7 / 42.3 | 33.0 / 34.3 |
| 30 | 512 | 136 / 571 | 135 / 749 | 139 / 791 | 131 / 134 |

**What the table says:**

- **The floor is about 33 ms**, and it does not move between 32 and 128
  tokens or between 7 and 30 options. That looks like a fixed sequence bucket,
  not work that scales with input.
- **The tail is streaks, not scatter.** Answers come in at about 33 ms or at
  about 170–220 ms, in runs of tens to hundreds. Which row catches a streak
  changes from run to run: 30 options / 32 tokens was clean in run A and slow
  in the conductor's run, where it was measured fourth, minutes after init. So
  it is neither the option count nor only a warm-up phase.
- **Headed does not remove it.** The visible-window run had the same streaks
  at its start. Headless rendering is not the cause.
- **512 tokens is a different regime**: a p50 around 130–147 ms, and a long
  tail on long runs.

From input to the displayed result, measured separately: p50 50 ms and p95
52 ms headless, and p95 34 ms headed.

**The cause of the streaks is not established.** Things to try before anyone
concludes the model is slow: a timed warm-up before measuring, MediaPipe's
nightly (`1.1.0-rc.20261006`), the WebGPU adapter's power preference, and
whether the streaks line up with GPU frequency or thermal state.

## CPU

The fallback for a browser without WebGPU, at n=100 per row (1,000 would take
about 2.5 hours): **p50 780–880 ms up to 128 tokens and about 3.1 s at 512**,
roughly 25 times the GPU. MediaPipe 1.1.0's CPU delegate is broken as shipped:
every evaluation throws `t(...).then is not a function`, because an Asyncify
build returns a plain value. The Worker wraps the evaluate functions in
`async` on CPU only, and the result records `thenablePatch: true`. A CPU
judge is not a suggestion that arrives while somebody types.

## Cost to the machine

- **Memory:** Chrome's process tree grew by **1.2–1.7 GB** while the model
  was loaded (1.7 GB on GPU, 1.2 GB on CPU). On a phone that is the number to
  watch.
- **Frames:** on the lab's stand-in scene (250 notes panned every frame, not
  the app's canvas), 0 frames over 20 ms headless and 0 over 16 ms headed at
  120 Hz, with the Worker answering continuously.
- **Install:** the runtime's 17.7 MB of wasm now ships in the web build, so
  the `#release` install grows by about 18 MB, whether or not anyone turns the
  judge on.
- **The entry chunk did not move:** 703,834 bytes before and after. The lab is
  its own Vite build.

## Privacy

The design says the claim is proved, not implied, so the driver checks it:

- **Offline, every request the page and Worker made went to the daemon's own
  origin.** That was 9–19 requests per run, none with a body and none carrying
  the state text. Chrome's net log shows nothing from the page left the
  machine. Chrome's own background requests (accounts, update, gstatic) failed
  name resolution, as intended.
- **MediaPipe phones home.** The JS bundle POSTs metrics to
  `odml.pa.googleapis.com` through `fetch`, on close and during use, in every
  run. Two layers stop it:
  - a `fetch` guard in the Worker, which refuses and records it;
  - **a Content-Security-Policy the browser enforces**: `connect-src 'self'`
    in the lab page's meta tag, and on the Worker script's own response from
    the daemon (`judge-worker-*.js` only). With the guard turned off, the
    policy blocked the request before it existed. Chrome reported the
    violation and no request appeared in CDP or the net log.

  The Worker's policy comes from whoever serves the Worker script. A hosted
  home must send the same header for that one file.
- **The model loads from a file too** (`?file=1`, or when `/models/<name>` is
  unavailable), for the phone. Only the byte length is checked on that path,
  because hashing 165 MB on a phone means holding it twice.

## Against the phase's bar

Phase 0's rule: if warm p95 is over 100 ms on the desktop, the page says so
and the project stops here until something changes.

**It is over.** At 32–128 tokens the median is 33–35 ms and the p95 is
170–200 ms in most rows of most runs. At 512 tokens the p95 is 580–810 ms in
every long run. The project stops at phase 0 by its own rule.

**What would change it** is one of two things. Explaining and removing the
streaks would leave a desktop judge that answers in about 34 ms at p95 up to
128 tokens, inside the bar with room to spare. Or a person can decide the bar
was drawn on the wrong number. A suggestion line that appears while somebody
types (Scene 1) may be judged by its median and how often it misses, rather
than by one answer's p95.

**Decided the same day.** Dion moved the bar to the warm median: 100 ms on
the desktop and 250 ms on a phone, with p95 and the share of late answers
reported beside it. The desktop passes up to 128 tokens and fails at 512
tokens (median 130–147 ms), so the next phase caps the state at 128 tokens.

## Phone

Run by Dion on 7 Oct 2026 on an **iPhone 17 Pro, iOS 27.0.1**, in Chrome for
iOS (which renders with WebKit, so this is Apple's WebGPU and not Chrome's),
from `dev.isocan.io/judge-lab.html?file=1&n=200`, with the model loaded from
a file. The probe reported WebGPU available (adapter `apple apple`). Not
recorded: memory, and the input-to-display and frame rows.

| | |
| --- | --- |
| Ready on GPU | load 1,469 ms, compile 2,363 ms, prewarm 1,788 ms |
| First answer | 35 ms |

Warm answers, n=200 per row, round trip in ms:

| Options | Tokens | p50 | p95 | p99 | Slow answers (over 2× median) |
| --- | --- | --- | --- | --- | --- |
| 7 | 32 | 32 | 36 | 36 | 0 |
| 7 | 128 | 33 | 40 | 43 | 1 |
| 7 | 512 | 142 | 153 | 155 | 0 |
| 30 | 32 | 40 | 44 | 44 | 0 |
| 30 | 128 | 42 | 46 | 47 | 0 |
| 30 | 512 | 179 | 193 | 201 | 0 |

**The phone passes its 250 ms median bar at every size**, 512 tokens
included, and its desktop-sized 100 ms bar up to 128 tokens. **It has no
streaks**: one slow answer in 1,200, where the M3 Max under Chrome for macOS
had streaks covering about one answer in five. The model and the question
were the same, and so was the median up to 128 tokens; what differed was the
browser's WebGPU. That points the streaks at Chrome's WebGPU on macOS, not
at the model or MediaPipe. It is a hint from one phone, not a finding.
