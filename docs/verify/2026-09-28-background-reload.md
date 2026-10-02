---
status: unverified
since: 2026-09-28
never: A hidden outdated tab reloading after a real deployment, while a foreground tab keeps its update pill.
needs: Two browser tabs on a hosted home and a deployment that changes the web app.
---

# A background tab catching up by itself

**Status: `unverified`.**

**What you need:** a browser, dev.isocan.io (or any home that gets deploys),
and one deploy that changes the web app. Five minutes of attention, spread
across however long the deploy takes.

**Why this page exists.** When isocan is upgraded, a tab that is already open
keeps running the old app and shows a pill: *isocan updated — reload to catch
up*. Since 28 September a tab that is **in the background** does not wait to
be asked — it reloads itself, so it is the current app the next time you open
it. The rule deciding *whether* it may is unit-tested
(`packages/web/test/appversion.test.ts`). **The reload itself never has been:**
the update check is switched off on the dev server, so no automated walk can
produce "the app on the server moved while this tab was hidden".

**The one trap.** The tab has to be running an app that *has* this feature
before the deploy you watch. A tab opened before commit `9effb990` reached
the home is running the old app, which only knows how to show the pill — so
open fresh tabs first, then wait for the *next* deploy.

---

## 1. Open two tabs on the same canvas

Once dev.isocan.io is serving a build that includes `9effb990`, open any
canvas there in **two tabs**, reloading each once so both are on the current
app. Call them *Front* and *Back*.

**You should see:** the canvas in both, no update pill in either.

## 2. Put one behind the other

Leave **Front** showing. Switch to another tab or app so **Back** is hidden.
Do not type anything into Back first, and do not leave an unfinished Pen
drawing or a half-written comment in it — those hold the reload on purpose.

## 3. Wait for a deploy

Any push to main that changes the web app, once it has gone `green` and
deployed. Nothing else to do.

**You should see, in Front:** the *isocan updated — reload to catch up* pill,
once its connection drops and comes back. Front must **not** reload by itself
— you are looking at it.

## 4. Look at Back

Switch to **Back**, at least ten seconds after Front showed the pill.

**You should see:** no pill. It already reloaded while you were away; the
canvas is where you left it.

**If Back shows the pill,** it noticed the update but did not reload — that is
the walk finding the bug. Note whether you had typed, drawn or commented in it
(any of which should hold it), and whether it had unsaved changes.

## 5. The hold (optional)

Repeat with Back holding a half-written comment, then hide it and wait for a
deploy.

**You should see:** Back **keeps** the pill and your comment. An unfinished
comment is not the tab's to throw away.

---

## What this walk does not cover

- **A window that is visible but not focused** — side by side with another —
  counts as being looked at, and keeps its pill. That is intended.
- **Editors whose drafts live only in the page** (a stage editor with unsaved
  changes, say) are held only while the cursor is in them. If one loses work
  here, that is a finding.
