// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Actor } from "@isocan/core";

/**
 * **One "you", everywhere** (14 Oct 2026).
 *
 * 424fe95a4 made the rename field read the name registry, as the facepile's
 * hover card does; the header chip beside it, the pile's own tooltip for your
 * face and every other "you" still showed the actor this browser stored at
 * sign-in. A rename made elsewhere left one menu saying two names. Now App
 * reconciles once (`useSelf`) and hands the routes the answer, and the
 * stored copy is refreshed so the next boot starts right.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { noteClaimed, useSelf } = await import("../src/lib/names.ts");
const { readIdentity, knownIdentities } = await import("../src/lib/identity.ts");
const { useCanvasStore } = await import("../src/stores/canvasStore.ts");

const stored: Actor = { id: "usr_acme", name: "Acme One" };
let seen: Actor | null;
let told: Actor[];
function Probe({ actor }: { actor: Actor | null }) {
  seen = useSelf(actor, (next) => told.push(next));
  return null;
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("isocan.identity", JSON.stringify({ ...stored, key: "web:k1" }));
  localStorage.setItem("isocan.identities", JSON.stringify([{ ...stored, key: "web:k1" }, { id: "usr_test", name: "Test" }]));
  useCanvasStore.setState({ actorNames: {} });
  seen = null;
  told = [];
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const show = (actor: Actor | null) => act(() => root.render(h(Probe, { actor })));

describe("who you are called", () => {
  it("is the stored name until the registry says otherwise", () => {
    show(stored);
    expect(seen).toBe(stored);
    expect(told).toEqual([]);
  });

  it("is the registry's name when the two disagree, and the stored copy catches up", () => {
    useCanvasStore.setState({ actorNames: { usr_acme: "Acme Person" } });
    show(stored);
    expect(seen).toEqual({ id: "usr_acme", name: "Acme Person" });
    expect(told).toEqual([{ id: "usr_acme", name: "Acme Person" }]);
    expect(readIdentity()).toEqual({ id: "usr_acme", name: "Acme Person" });
    // The roster row too, and nobody else's; the key survives the refresh.
    expect(knownIdentities()).toEqual([{ id: "usr_acme", name: "Acme Person" }, { id: "usr_test", name: "Test" }]);
    expect(JSON.parse(localStorage.getItem("isocan.identity")!).key).toBe("web:k1");
  });

  it("a claim that just landed is not overruled by the roster heard before it", () => {
    useCanvasStore.setState({ actorNames: { usr_acme: "Acme One" } });
    const renamed = { id: "usr_acme", name: "Acme Renamed" };
    noteClaimed(renamed);
    show(renamed);
    expect(seen).toBe(renamed);
  });
});

describe("every surface is handed the same actor", () => {
  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  it("App reconciles once and routes the answer, not the stored copy", () => {
    const app = read("../src/App.tsx");
    expect(app).toContain("const actor = useSelf(stored, setStored);");
    expect(app).toContain("if (next) noteClaimed(next);");
  });
  it("the header chip and the menu read the same name", () => {
    // The chip draws `actor.name` of the reconciled actor; the menu's field
    // asks the registry. Both are the registry's answer now.
    expect(read("../src/pages/CanvasListPage.tsx")).toMatch(/\{faceMark\(marks, actor\)\}\s*<\/span>\s*\{actor\.name\}/);
    expect(read("../src/components/IdentityMenu.tsx")).toContain("const current = actorNameIn(useActorNames(), actor);");
  });
});
