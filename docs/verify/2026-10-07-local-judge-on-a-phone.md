---
status: works
since: 2026-10-07
never: "the local judge (EmbeddingGemma 2 in a browser Worker) on a phone: whether it loads at all, how fast it answers, and what it costs in memory; local-judge phase 0's phone half"
needs: "an iPhone (and an Android phone, if you have one) with about 400 MB free, Wi-Fi, and fifteen minutes; dev.isocan.io must be at or after the commit that added judge-lab.html"
---
# The local judge on a phone

**What you need:** a phone, Wi-Fi, about 400 MB of free space (the model is
165 MB, and the browser needs room to load it), and fifteen minutes. Nothing
to install.

**Why this page exists.** local-judge phase 0 measured a small embedding
model answering questions inside a desktop browser, in about 34 ms at its
median ([the numbers](../research/2026-10-07-embeddinggemma-in-the-browser.md)).
Whether a phone can do it at all is unknown. The model needs WebGPU for
speed and takes over a gigabyte of memory on the desktop, and a phone
browser may refuse either. The phase's bar for a phone is a warm p95 under
250 ms.

The page only measures. It sends nothing anywhere: the browser itself is told
to refuse any connection except to the page's own site.

---

1. **On the phone**, download the model file. Open this link and save the
   file (on an iPhone, to Files):

   <https://huggingface.co/litert-community/embeddinggemma-2-text-270m-litert-lm/resolve/main/embeddinggemma-2-text-270m.litertlm>

   It is 164.6 MB and named `embeddinggemma-2-text-270m.litertlm`.
2. **On the phone**, open <https://dev.isocan.io/judge-lab.html?file=1&n=200>.
   **You should see** a sentence saying whether WebGPU is available here.
   If it says it is not, write that down. It is the most important finding,
   and you can still go on: it will measure the slow path.
3. Tap **Choose a model file…** and pick the file from step 1.
   **You should see** it accept the file. If it says the size is wrong, the
   download did not finish; download it again.
4. Tap **Measure on GPU** — or **Measure on CPU** only if step 2 said WebGPU
   is not available. Keep the phone awake and the page in front. A progress
   line shows which row it is on; the GPU run takes a few minutes, the CPU
   one much longer.
5. When it finishes, tap **Copy results** and paste them somewhere you can
   send (Notes, a message to yourself). If copying is refused, the page says
   so; select the text and copy it by hand.
6. Note the phone's model and iOS or Android version, and whether the phone
   got warm.

## What you should see

A table of answer times. **Good:** the "warm p95" numbers at 32 and 128
tokens are under 250 ms. **Over 250 ms, or the page crashed or reloaded
itself** (a phone browser does that when it runs out of memory): that is the
answer, and it is a useful one.

## Writing it down

Paste the results and the phone details into the
[research page](../research/2026-10-07-embeddinggemma-in-the-browser.md)
under a new "Phone" heading. Or hand them to whoever is working on
local-judge: an agent can do the writing up. Then set this page's front
matter to `works` (it ran, whatever the numbers), or `broken` with an issue
if the page itself failed.
