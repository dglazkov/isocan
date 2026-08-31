import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { rules, withoutComments } from "./cssrules.ts";

/**
 * **A lens is not a canvas, and this is the surface where that is easiest to
 * forget.**
 *
 * It shows things from many canvases on one page, which looks exactly like a
 * canvas — and an item's `x`/`y` belong to the canvas it is on, so there is no
 * true answer to a drag here. `docs/research/2026-08-30-standing-agents.md`
 * names the three ways out and only one is honest: derive the arrangement,
 * store nothing, refuse the drag.
 *
 * The failure this guards against is not a bug that exists today. It is the
 * very reasonable-looking change somebody makes in three months — a tile grid,
 * a saved position, a drag handle — each of which quietly turns this into a
 * second place an item's location is decided.
 */
const src = readFileSync(
  fileURLToPath(new URL("../src/pages/LensPage.tsx", import.meta.url)),
  "utf8",
);
const bare = src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\/.*$/gm, "");

describe("the lens page", () => {
  it("folds with core, so it cannot disagree with `isocan lens`", () => {
    expect(bare).toContain("lensEntries(");
    expect(bare).toContain("lensGroups(");
  });

  it("stores no position and offers no drag", () => {
    /* The physics, as a check somebody has to argue with rather than walk
       past: a position written here has nowhere true to land. */
    expect(bare).not.toMatch(/draggable|onDragStart|onPointerDown|style=\{\{ left:/);
    expect(bare).not.toMatch(/\bx:\s|\by:\s/);
  });

  it("says out loud that things live elsewhere", () => {
    /* Discovered by trying to drag is the worst way to learn this. The
       sentence is in core so both surfaces say the same one. */
    expect(bare).toContain("LENS_REFUSAL");
  });

  it("makes every row a link to where the thing really is", () => {
    /* A reference that cannot be followed is a list of things you cannot get
       to, which is the failure mode of every "virtual" view. */
    expect(bare).toMatch(/itemPath\(e\.canvasId, e\.itemId\)/);
  });

  it("reads through the api lib, not a hand-written route", () => {
    /* I wrote `/api/canvases` from memory and it 404s — `listCanvases` knows
       the route this build serves, carries the badge, and recovers at the
       door. */
    expect(bare).toContain("listCanvases()");
    /* The other half of this — that no hand-written route appears here at all
       — moved to `throughthedoor.test.ts`, which asks it of every file in the
       app rather than of this one. It was asked here because this is where
       the mistake was made that day, and asking it here was how seven more
       hand-written routes lived in five other files with this test green. */
  });

  it("survives one canvas it cannot read", () => {
    /* A lens over nine canvases should not go blank because one is shut. */
    expect(bare).toMatch(/getSnapshot\(canvas\.id\)\.catch/);
  });

  it("disambiguates two subjects with one name", () => {
    expect(bare).toContain("lensSubjectLabels");
  });
});

describe("the lens's stylesheet", () => {
  const sheet = rules(withoutComments()).filter((r) => /\.lens-/.test(r.selector));

  it("exists, and takes its colours from tokens", () => {
    expect(sheet.length).toBeGreaterThan(0);
    for (const r of sheet) expect(r.body).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("lays rows out as a list, never as a positioned surface", () => {
    /* A tile grid with coordinates is the shape that would make somebody
       reach for a drag. Rows cannot be mistaken for a canvas. */
    for (const r of sheet) {
      expect(r.body, r.selector).not.toMatch(/position:\s*absolute/);
    }
  });
});

/**
 * **Narrowing** (phase 2) — the gallery is the answer at thirty things and a
 * wall at three hundred.
 */
describe("the lens narrows", () => {
  it("filters with the shared function, so the CLI agrees", () => {
    /* `isocan lens --kind screen` and the app's chip have to mean one thing,
       or the surfaces disagree about what an agent has been doing. */
    expect(bare).toContain("filterLens(all, filter,");
  });

  it("offers only the kinds that are actually there", () => {
    /* A chooser listing kinds nobody has made is a menu of dead ends. */
    expect(bare).toContain("lensKinds(all)");
  });

  it("counts kinds BEFORE filtering", () => {
    /* Otherwise choosing a kind empties the list you chose it from, and the
       counts shrink to whatever you last picked. */
    expect(bare).toMatch(/lensKinds\(all\), \[all\]/);
  });

  it("shows the controls only when there are enough things to need them", () => {
    /* And counts what the subject HAS, not what is showing — otherwise a
       narrow filter removes the controls you narrowed with. */
    expect(bare).toMatch(/all\.length > NARROW_FROM/);
    expect(bare).not.toMatch(/entries\.length > NARROW_FROM/);
  });

  it("says so when a filter matches nothing", () => {
    /* A narrowed lens matching nothing looks exactly like an agent who has
       made nothing. */
    expect(bare).toMatch(/Nothing here matches that/);
  });

  it("turns a chip off by removing the key, not by nulling it", () => {
    /* A filter carrying a field that means nothing is a filter that will
       eventually be read as meaning something. */
    expect(bare).toMatch(/function toggle</);
    expect(bare).toMatch(/const \{ \[key\]: _gone, \.\.\.rest \} = filter/);
  });
});

/**
 * **The record** (phase 3) — "Did" reads the log, because a portfolio cannot
 * show work that was made and then deleted.
 */
describe("the lens remembers what it can no longer show", () => {
  it("folds acts with core, like everything else on this page", () => {
    expect(bare).toContain("lensActs(logs, subject.id)");
    expect(bare).toContain("lensShape(acts)");
  });

  it("reads the logs through the door", () => {
    /* A log that 401s and resolves to `[]` says "this agent did nothing" —
       a wrong answer wearing a true answer's face. `getOplog` knocks. */
    expect(bare).toContain("getOplog(source.canvasId)");
  });

  it("fetches nothing until somebody asks the second question", () => {
    /* A log per canvas is the cost this page exists to avoid paying by
       default — the same bargain the card peek makes. The guard is the
       early return, because that is the line a refactor deletes. */
    expect(bare).toMatch(/if \(mode !== "did" \|\| !sources \|\| logs\) return;/);
  });

  it("says the word the CLI says", () => {
    /* `opWords` is shared, so "added something" is not this page's phrasing
       of an op — it is the phrasing. */
    expect(bare).toMatch(/opWords\(act\.op\)/);
  });

  it("distinguishes still-loading from genuinely nothing", () => {
    /* Both are an empty list, and they mean opposite things. */
    expect(bare).toMatch(/logs === null/);
    expect(bare).toMatch(/logs !== null && acts\.length === 0/);
  });

  it("keeps every act reachable, even when the thing is gone", () => {
    /* An act cannot link to an item that was deleted, so it links to the
       canvas it happened on. A record you cannot walk back into is trivia. */
    expect(bare).toMatch(/canvasPath\(act\.canvasId\)/);
  });
});

/**
 * **Presence** (phase 4) — the one present-tense fact on a page that is
 * otherwise entirely past tense.
 */
describe("the lens says who is live", () => {
  it("folds presence with core, so the CLI agrees about standing by", () => {
    expect(bare).toContain("lensLive(");
    expect(bare).toContain("lensLiveList(");
  });

  it("reads it, rather than opening a socket per canvas", () => {
    /* Presence rides the per-canvas socket. This page spans a dozen canvases
       and holds a socket to none of them; a dozen connections to draw a dozen
       dots is a cost nobody asked for, and a dot a few seconds stale is still
       a dot. */
    expect(bare).toContain("fetchPresenceWhere()");
    expect(bare).not.toMatch(/new WebSocket|subscribe\(/);
  });

  it("stops polling when the page goes away", () => {
    /* An interval that outlives its page is a leak that only shows up after
       somebody has navigated around for an hour. */
    expect(bare).toMatch(/clearInterval\(timer\)/);
  });

  it("names the canvas on a subject's page, rather than only counting", () => {
    /* "On a canvas now" invites exactly one question, and the page could not
       answer it: the canvas somebody is SITTING on is often not one they have
       made anything on, so no group heading below is theirs. */
    expect(bare).toMatch(/lensLiveList\(live\)\.map/);
    expect(bare).toMatch(/canvasPath\(at\.canvasId\)/);
  });

  it("never renders a confident 'offline'", () => {
    /* Absent from every room this daemon can see is not "not working" — an
       agent busy on a canvas homed elsewhere appears here as nothing. Saying
       offline would be the instrument reporting its blind spot as a fact
       about somebody. */
    expect(bare).not.toMatch(/offline|not working|away\b/i);
  });
});

describe("here and standing by do not look alike", () => {
  const sheet = rules(withoutComments()).filter((r) => /lens-live-dot/.test(r.selector));

  it("has a rule for each state", () => {
    expect(sheet.some((r) => /\.standby/.test(r.selector))).toBe(true);
  });

  it("makes the standby dot differ in more than a shade", () => {
    /* The whole value of presence is that it is honest: a facepile showing
       six faces on a canvas nobody is working on has stopped meaning
       anything, and so has a dot that looks the same either way. Filled
       versus a ring survives a colourblind reader and a greyscale screen;
       two greens would not. */
    const standby = sheet.find((r) => /\.standby/.test(r.selector));
    expect(standby?.body).toMatch(/background:\s*transparent/);
    expect(standby?.body).toMatch(/inset/);
  });

  it("takes its colour from a token, like everything else", () => {
    for (const r of sheet) expect(r.body, r.selector).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
