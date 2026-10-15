import { CanvasHandle, readDesignAudit } from "@isocan/api";
import { readDeskCheck } from "@isocan/api/desk-check";
import type { Canvas, CanvasSnapshotResponse } from "@isocan/core";
import { deskCheckFindings, deskCheckSections, deskCheckSummary, type DeskCheckInput, type DeskCheckSection } from "@isocan/core/desk-check";
import type { Ctx } from "./ctx.ts";
import type { CliHost, CliModule } from "./modulehost.ts";

/**
 * **The desk check, from a terminal** (proactive-agent phase 8, design §9
 * "Before you share"). `isocan share` and `isocan present` run it before
 * they do anything, and `isocan share --check` runs it alone. It reads the
 * canvas through `@isocan/api/desk-check` — the reader the Share dialog
 * uses — and asks the canvas's lead to wear every critic set to *before I
 * share*, once per screen version (the critique module's part).
 * **It never blocks**: whatever it finds, and whatever goes wrong reading
 * it, the share goes ahead.
 *
 * Loaded on those verbs only, with main's helpers handed in (`DeskCheckDeps`).
 */
export interface DeskCheck {
  input: DeskCheckInput;
  sections: DeskCheckSection[];
  summary: string;
}

/**
 * What `main.ts` hands the check: the modules loaded here, each of which may
 * add a part (`CliModule.deskCheck` — the wireframe module's wires behind,
 * the critique module's critics), and the host they are handed. Handed in
 * rather than imported: this chunk names no module, so removing one removes
 * its line and nothing else.
 */
export interface DeskCheckDeps {
  modules: readonly CliModule[];
  host: CliHost;
}

/** **Run the desk check** over every screen (a share) or the named ones (a present). Never throws. */
export async function deskCheck(ctx: Ctx, deps: DeskCheckDeps, canvas: Canvas, snapshot: CanvasSnapshotResponse, itemIds?: readonly string[]): Promise<DeskCheck | { failed: string }> {
  try {
    const handle = new CanvasHandle(ctx, canvas);
    const found = await readDeskCheck(
      {
        text: async (hash) => (await ctx.client.downloadBlob(canvas.id, hash)).toString("utf8"),
        audit: (ids) => readDesignAudit(ctx, canvas.id, { itemIds: [...ids] }, snapshot),
        staleReceipts: async () => {
          const rows = (await handle.designBrief({})).requests;
          return rows.flatMap((row) => row.receipts.filter((r) => r.status === "stale").map((r) => {
            const out = r.receipt.output.kind === "canvas" ? snapshot.canvas.items[r.receipt.output.artifact.itemId]?.title : undefined;
            return { title: out || row.brief.primaryTask || row.brief.requestId, why: r.reasons[0] ?? "its inputs changed since it was written" };
          }));
        },
        wiresBehind: async (c) => {
          const read = async (hash: string) => (await ctx.client.downloadBlob(canvas.id, hash)).toString("utf8");
          const parts = deps.modules.flatMap((m) => (m.deskCheck?.behind ? [m.deskCheck.behind] : []));
          return (await Promise.all(parts.map((behind) => behind(c, read).catch(() => [])))).flat();
        },
      },
      snapshot.canvas,
      itemIds ? { itemIds } : {},
    );
    const bare = deskCheckSections({ ...found, critics: [] });
    const asks = deps.modules.flatMap((m) => (m.deskCheck?.critics ? [m.deskCheck.critics] : []));
    const critics = (await Promise.all(asks.map((ask) => ask(deps.host, ctx, canvas, snapshot, found.screens.map((s) => s.itemId), deskCheckFindings(bare))
      .catch((err: unknown) => [{ agentName: "The critics", asked: false, why: err instanceof Error ? err.message : String(err) }])))).flat();
    const input = { ...found, critics };
    const sections = deskCheckSections(input);
    return { input, sections, summary: deskCheckSummary(sections) };
  } catch (err) {
    return { failed: err instanceof Error ? err.message : String(err) };
  }
}

/** The check as a person reads it, above the share's own lines: ✓ for fine, ! for a look. */
export function printDeskCheck(check: DeskCheck | { failed: string }): void {
  if ("failed" in check) {
    console.log(`Desk check could not run (${check.failed}) — the share goes ahead; it never blocks.`);
    return;
  }
  console.log(check.summary);
  for (const s of check.sections) {
    const [first, ...rest] = s.lines;
    console.log(`  ${s.key === "critics" ? "·" : s.ok ? "✓" : "!"} ${s.heading}: ${first ?? ""}`);
    for (const line of rest) console.log(`      ${line}`);
  }
  console.log("");
}
