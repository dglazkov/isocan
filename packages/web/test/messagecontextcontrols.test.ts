import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MessageContextPreview } from "../src/components/GroupContext.tsx";
import { messageContextRequest } from "../src/lib/messagecontext.ts";

/**
 * **The message-context controls appear only when they can do something.**
 *
 * The preview above a composer (what a message carries when items are
 * selected) always rendered two controls — "Include excluded items for this
 * message" and "Refresh context" — as bare browser defaults, whether anything
 * was excluded or the preview was behind. The same day Refresh went entirely:
 * the preview follows the canvas and a message carries no revision. Reported 23 Sep 2026 as "bad layout,
 * and what even is it?". The real component is rendered here; no manifest is
 * given, so only the controls are under test.
 */
type Context = Parameters<typeof MessageContextPreview>[0]["context"];

const base = {
  enabled: true, manifest: null, request: null, includeExcluded: false,
  setIncludeExcluded: () => {}, refresh: () => {}, error: "", loading: false, stale: false,
} as unknown as Context;

const render = (over: Partial<Record<string, unknown>>) => renderToStaticMarkup(h(MessageContextPreview, { context: { ...base, ...over } as Context }));
const excluded = (n: number) => ({ counts: { included: 2, excluded: n, unavailable: 0 } });

describe("message context controls", () => {
  it("shows neither control for a current preview with nothing excluded", () => {
    const html = render({ stale: false, includeExcluded: false });
    expect(html).not.toContain("Refresh");
    expect(html).not.toContain("excluded");
  });

  it("asks nothing when the preview is behind the canvas — it rebuilds itself", () => {
    const html = render({ stale: true });
    expect(html).not.toContain("Refresh");
    expect(html).not.toContain("changed since");
  });

  it("offers Try again only when the preview failed to load", () => {
    const html = render({ error: "home unreachable" });
    expect(html).toContain("The preview did not load.");
    expect(html).toMatch(/class="message-context-action"[^>]*>Try again</);
  });

  it("sends roots and the override, never a revision the home could refuse over", () => {
    expect(messageContextRequest(["itm_a", "itm_b"], true)).toEqual({ rootIds: ["itm_a", "itm_b"], includeExcluded: true });
    expect(messageContextRequest(["itm_a"], false)).not.toHaveProperty("expectedRevision");
  });

  it("offers the override only when something is excluded, and says how many", () => {
    const manifest = (n: number) => ({ canvasId: "prj_acme", revision: 4, rootIds: ["itm_a"], expandedIds: ["itm_a", "itm_b"], entries: [], ...excluded(n) });
    expect(render({ manifest: manifest(0) })).not.toContain("Include the");
    expect(render({ manifest: manifest(3) })).toContain("Include the 3 excluded items in this message");
    expect(render({ manifest: manifest(1) })).toContain("Include the 1 excluded item in this message");
    // Already on: it stays, so it can be turned off again.
    expect(render({ manifest: manifest(0), includeExcluded: true })).toContain("Include the 0 excluded items");
  });
});
