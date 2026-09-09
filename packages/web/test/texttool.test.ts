import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PAPERS, TEXT_FACES, TEXT_STYLES, paperLabel, textFaceLabel } from "@isocan/core";

import { textToolMenu } from "../src/lib/textmenu.ts";
import { useUiStore } from "../src/stores/uiStore.ts";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/**
 * **The two halves of the text tool Dion asked for** (9 Sep 2026).
 *
 * > "if you right click on it, show the colors and font settings and the user
 * > can select them and they are now the default"
 *
 * > "when you click away it switches to the select tool UNLESS the user was
 * > holding down the T key when they clicked... then it STAYS on the text tool"
 *
 * The first is a second door onto state that already existed; the second gives
 * the tool's two entry gestures two different endings. What both have in
 * common is that they are about a MODE, and a mode left in the wrong state is
 * the kind of bug a person feels for an hour before they can describe it.
 */

describe("what the next text node will look like", () => {
  it("offers every size, font and paper the app can make", () => {
    /* The menu is built from core's lists rather than its own, so a face added
       to `TEXT_FACES` appears here without anybody remembering — the failure
       this prevents is a picker that silently stops offering the newest
       option. */
    const menu = textToolMenu();
    const rows = (name: string) =>
      (menu.find((e) => "label" in e && e.label === name) as { submenu?: { label: string }[] } | undefined)
        ?.submenu?.map((s) => s.label ?? "—") ?? [];
    expect(rows("Font")).toEqual(TEXT_FACES.map(textFaceLabel));
    // The "—" is the separator between "None" and the five papers: a rule,
    // because no paper and a paper are two kinds of answer rather than six of
    // one.
    expect(rows("Paper")).toEqual(["None", "—", ...PAPERS.map(paperLabel)]);
    expect(rows("Size").length).toBe(TEXT_STYLES.length);
  });

  it("writes the default the composer reads, rather than a second one", () => {
    /**
     * The whole argument for this feature: the state already existed and stuck,
     * and what was missing was a way to reach it without placing a node you did
     * not want. If this wrote anywhere else there would be two defaults, and
     * the one the composer reads would be the one nobody could see.
     */
    const before = useUiStore.getState().lastTextFace;
    const other = TEXT_FACES.find((f) => f !== before)!;
    const menu = textToolMenu();
    const font = menu.find((e) => "label" in e && e.label === "Font") as {
      submenu: { label: string; run: () => void }[];
    };
    font.submenu.find((r) => r.label === textFaceLabel(other))!.run();
    expect(useUiStore.getState().lastTextFace).toBe(other);
    useUiStore.getState().setLastText(useUiStore.getState().lastTextStyle, before, useUiStore.getState().lastPaper);
  });

  it("ticks what is current, so the menu says what you are about to get", () => {
    const { lastTextFace } = useUiStore.getState();
    const font = textToolMenu().find((e) => "label" in e && e.label === "Font") as {
      value?: string;
      submenu: { label: string; checked?: boolean }[];
    };
    expect(font.value).toBe(textFaceLabel(lastTextFace));
    expect(font.submenu.filter((r) => r.checked).map((r) => r.label)).toEqual([textFaceLabel(lastTextFace)]);
  });
});

describe("the tool hands itself back after one node", () => {
  const place = (oneShot: boolean) => {
    const ui = useUiStore.getState();
    ui.setActiveTool("text");
    ui.setPendingText({
      x: 0,
      y: 0,
      itemId: null,
      body: "",
      style: ui.lastTextStyle,
      face: ui.lastTextFace,
      paper: ui.lastPaper,
      oneShot,
    });
  };

  it("returns to Select when a one-shot placement closes", () => {
    place(true);
    expect(useUiStore.getState().activeTool).toBe("text");
    useUiStore.getState().setPendingText(null);
    expect(useUiStore.getState().activeTool).toBe("select");
  });

  it("stays on Text when the placement was made with T held", () => {
    /* The hold is the person saying "I am placing several". Handing the tool
       back then is the tool doing the opposite of what the gesture asked. */
    place(false);
    useUiStore.getState().setPendingText(null);
    expect(useUiStore.getState().activeTool).toBe("text");
    useUiStore.getState().setActiveTool("select");
  });

  it("never moves the tool when an existing node is being re-worded", () => {
    /**
     * `ItemView` opens a pending too, and that must not touch the tool. This is
     * why the flag rides on the pending node rather than sitting beside it in
     * the store: a store flag would have to remember which pending it belonged
     * to, and the day it got that wrong, double-clicking a caption would drop
     * you out of whatever tool you were in.
     */
    const ui = useUiStore.getState();
    ui.setActiveTool("text");
    ui.setPendingText({ x: 0, y: 0, itemId: "itm_1", body: "hi", style: ui.lastTextStyle, face: ui.lastTextFace, paper: null });
    useUiStore.getState().setPendingText(null);
    expect(useUiStore.getState().activeTool).toBe("text");
    useUiStore.getState().setActiveTool("select");
  });

  it("leaves a tool the person picked more recently alone", () => {
    /* Choosing another tool while the composer is open has already answered
       the question; putting Select back on top of that would undo a choice
       made after the one this is carrying out. */
    place(true);
    useUiStore.getState().setActiveTool("pen");
    useUiStore.getState().setPendingText(null);
    expect(useUiStore.getState().activeTool).toBe("pen");
    useUiStore.getState().setActiveTool("select");
  });

  it("decides one-shot at the press, and a used hold latches", () => {
    /**
     * The half that lives in the viewport's pointer handler and cannot be
     * reached from here without a DOM: asserted as the two facts it turns on.
     * Naming them is worth it because both are easy to delete by accident and
     * neither fails visibly in a unit test — the tool just feels wrong.
     */
    const src = read("../src/components/CanvasViewport.tsx");
    expect(src, "the press reads whether T is being held").toMatch(
      /holdTool\.current\?\.code === "KeyT"/,
    );
    expect(src, "a placement marks the hold as used").toMatch(/holdTool\.current\.used = true/);
    expect(src, "and a used hold keeps the tool instead of handing it back").toMatch(
      /wasHeld\(held\.downAt, Date\.now\(\)\) && held\.used !== true/,
    );
    expect(src, "the pending carries the answer").toMatch(/oneShot: !borrowing/);
  });
});
