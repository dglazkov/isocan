import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ApiError } from "../src/lib/api.ts";
import { RefusalNote, refusalFor } from "../src/components/NameTaken.tsx";

/**
 * **The refusal renders its remedy** (multi-identity phase 3).
 *
 * `claims.ts` refuses a claim with `name-taken` from two places, and both
 * messages are written for the CLI: one names `isocan pass`, the other names
 * `--as` and `--new`. The door and the identity menu now render their own
 * sentence for that code, with **Prove your address** as a control, and keep
 * showing the server's words for every other code.
 *
 * There is no DOM in this suite, so the click that would show the refusal in
 * a rendered door cannot happen here. What can be held:
 *
 * - `refusalFor` sorts on the wire code alone — a reworded message still
 *   branches, and a different code does not.
 * - `RefusalNote`, the component both surfaces render in their warning slot,
 *   draws the copy with the control, or without it where there is nowhere for
 *   the control to lead.
 * - The two surfaces route their refusals through it and wire the control to
 *   the right place — read from the source, as `renamebutton.test.ts` and
 *   `cloudagent.test.ts` do for the same menu.
 * - No file under `packages` still names the menu entry by its old label,
 *   the one that began "Work from…"; it is "Bring your own agent…" now.
 *
 * The clicks themselves are walked in the phase's proof.
 */

const SERVER_TEXT =
  '"Dimitri" is taken here (usr_1, on "Acme") — @Dimitri would reach both of you. Pick another ' +
  "name, or claim without one to be handed a free one; `--as usr_1` if you are Dimitri " +
  "returning from a lost session, or `--new` to be a second Dimitri on purpose.";
const COPY = "<b>Dimitri is somebody else here.</b> Another surface already speaks as them.";
const CONTROL =
  'If that&#x27;s you: <button type="button" class="identity-prove-open">Prove your address</button> — or pick a different name.';

const note = (refusal: ReturnType<typeof refusalFor>, onProve: (() => void) | null) =>
  renderToStaticMarkup(h(RefusalNote, { refusal, onProve }));

const source = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("refusalFor sorts on the code, not the words", () => {
  it("branches on name-taken whatever the message says", () => {
    // Neither of the server's two messages: the code is the contract.
    const err = new ApiError(409, "some wording nobody has written yet", "name-taken");
    expect(refusalFor(err, "Dimitri")).toEqual({ kind: "name-taken", name: "Dimitri" });
    // And the message `requireFree` actually writes, with its CLI flags.
    expect(refusalFor(new ApiError(409, SERVER_TEXT, "name-taken"), "Dimitri")).toEqual({
      kind: "name-taken",
      name: "Dimitri",
    });
  });

  it("keeps the server's message for every other code", () => {
    const err = new ApiError(403, "this badge may not speak as usr_1", "not-yours");
    expect(refusalFor(err, "Dimitri")).toEqual({
      kind: "message",
      text: "this badge may not speak as usr_1",
    });
    // No code at all, and an error that is not the home's answer.
    expect(refusalFor(new ApiError(500, "HTTP 500"), "Dimitri")).toEqual({
      kind: "message",
      text: "HTTP 500",
    });
    expect(refusalFor(new TypeError("fetch failed"), "Dimitri")).toEqual({
      kind: "message",
      text: "fetch failed",
    });
  });
});

describe("the note the door and the menu render", () => {
  it("draws the copy and the control for name-taken, and none of the server's words", () => {
    const html = note(refusalFor(new ApiError(409, SERVER_TEXT, "name-taken"), "Dimitri"), () => {});
    expect(html).toBe(`<div class="identity-warning">${COPY} ${CONTROL}</div>`);
    expect(html).not.toContain("--as");
    expect(html).not.toContain("--new");
    expect(html).not.toContain("is taken here");
  });

  it("draws the copy without the control where there is nowhere for it to lead", () => {
    const html = note(refusalFor(new ApiError(409, SERVER_TEXT, "name-taken"), "Dimitri"), null);
    expect(html).toBe(`<div class="identity-warning">${COPY} Pick a different name.</div>`);
    expect(html).not.toContain("<button");
    expect(html).not.toContain("If that");
  });

  it("names the name the person asked for, escaped like any text", () => {
    const html = note(refusalFor(new ApiError(409, "x", "name-taken"), "Di <3"), null);
    expect(html).toContain("<b>Di &lt;3 is somebody else here.</b>");
  });

  it("renders the server's message unchanged for any other code", () => {
    const html = note(refusalFor(new ApiError(403, "this badge may not speak as usr_1", "not-yours"), "Dimitri"), () => {});
    expect(html).toBe('<div class="identity-warning">this badge may not speak as usr_1</div>');
    expect(html).not.toContain("somebody else here");
  });
});

describe("the door's branch", () => {
  const door = source("../src/components/IdentityDialog.tsx");

  it("routes every refused claim through refusalFor, naming what was asked for", () => {
    expect(door).toContain("setError(refusalFor(err, name));");
    expect(door).toContain("attempt(enterAs(trimmed), trimmed)");
    expect(door).toContain("attempt(adoptIdentity(actor), actor.name)");
    // The server's message is never put in the slot as a string any more.
    expect(door).not.toContain("setError(err.message)");
  });

  it("wires the control to state B, and only while B can be reached", () => {
    expect(door).toContain(
      "<RefusalNote refusal={error} onProve={canProve ? () => setProving(true) : null} />",
    );
    expect(door).toContain(
      "offer !== null && canVerifyEmail(offer) && offer.attestations.length === 0 && sent === null",
    );
    // B's `open` is the door's, so the refusal's control and the quiet line
    // open the same field.
    expect(door).toContain("open={proving}");
    expect(door).toMatch(/className="identity-prove-open" onClick=\{onOpen\}/);
  });
});

describe("the identity menu's branch", () => {
  const menu = source("../src/components/IdentityMenu.tsx");

  it("routes the rename and the switch through refusalFor", () => {
    expect(menu).toContain("setError(refusalFor(err, name))");
    expect(menu).toContain("attempt(renameIdentity(trimmed), trimmed)");
    expect(menu).toContain("attempt(adoptIdentity(other), other.name)");
    expect(menu).not.toContain("setError(err.message)");
  });

  it("opens the Prove your address panel in place of the menu, behind the attester gate", () => {
    expect(menu).toContain(
      "<RefusalNote refusal={error} onProve={canProve ? () => setVerify(true) : null} />",
    );
    expect(menu).toContain("const canProve = offer !== null && canVerifyEmail(offer);");
    // The same `setVerify(true)` the menu's own entry uses.
    expect(menu).toMatch(/if \(verify\) \{[\s\S]*?VerifyDialog/);
  });
});

describe("the renamed menu entry", () => {
  /** Every source file under `packages`, skipping installed and built output. */
  function sources(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === "dist") continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) sources(path, out);
      else if (/\.(ts|tsx|mjs|md)$/.test(name)) out.push(path);
    }
    return out;
  }

  it('is named "Bring your own agent…" everywhere, and the old label is gone', () => {
    const packages = fileURLToPath(new URL("../../", import.meta.url));
    // Spelled in pieces so this file is not the one match.
    const needle = ["Work", "from", "your"].join(" ");
    const stale = sources(packages).filter((path) => readFileSync(path, "utf8").includes(needle));
    expect(stale.map((p) => p.slice(packages.length))).toEqual([]);
    // And the two places phase 3 corrected say the current label.
    expect(source("../../core/src/claims.ts")).toContain("“Bring your own ");
    expect(source("../src/components/VerifyDialog.tsx")).toContain('"Bring your\n * own agent…"');
  });
});
