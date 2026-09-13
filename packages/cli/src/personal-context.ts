import type { Command } from "commander";
import { DaemonClient, resolveCanvas, resolveIdentity, reclaimIdentity } from "@isocan/api";
import { canvasUrl, newOpId, normalizeHomeUrl, type PersonalStatusResponse } from "@isocan/core";
import type { Ctx } from "./ctx.ts";
import { printJson } from "./output.ts";

function statusText(answer: PersonalStatusResponse): void {
  console.log(`${answer.owner.name}'s personal canvas at ${answer.home}`);
  if (answer.source) console.log(`${answer.source.state}: ${canvasUrl(answer.home, answer.source.canvasId)}`);
  else console.log("Not created. Run `isocan context personal` to create it privately.");
  for (const source of answer.preserved) console.log(`preserved ${source.state}: ${canvasUrl(answer.home, source.canvasId)}`);
}

/** Personal acts always name the selected actor; creating a source never resolves a working canvas. */
export function registerPersonalContext(context: Command, contextOf: (cmd: Command) => Promise<Ctx>): void {
  const personal = context.command("personal")
    .description("Open or create your private canvas at a home; inspect links, read and delegate explicitly")
    .option("--home <url>", "use this authoritative home instead of the connected daemon");
  const act = (work: (ctx: Ctx, args: any[]) => Promise<void>) => async (...args: any[]) => {
    try {
      const command = args.at(-1) as Command;
      const ctx = await contextOf(command);
      const actor = ctx.actor;
      const home = command.optsWithGlobals().home as string | undefined;
      if (home !== undefined && normalizeHomeUrl(home) !== normalizeHomeUrl(ctx.client.base)) {
        // Reuse this command's selected identity and the credential held for the
        // named home. Looking up another home's session could select another person.
        const selected = await resolveIdentity(ctx.client, ctx.home);
        if (!selected || selected.actor.id !== actor.id) throw new Error("The selected identity changed; retry as the intended actor.");
        const client = new DaemonClient(normalizeHomeUrl(home), ctx.home);
        client.reclaimWith(() => reclaimIdentity(client, selected));
        ctx.client = client;
      }
      await work(ctx, args);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  };
  personal.action(act(async (ctx) => {
    const answer = await ctx.client.ensurePersonal(ctx.actor.id);
    if (ctx.json) return printJson(answer);
    statusText(answer);
  }));
  personal.command("status").description("Inspect your binding without creating a canvas").action(act(async (ctx) => {
    const answer = await ctx.client.personalStatus(ctx.actor.id);
    if (ctx.json) return printJson(answer);
    statusText(answer);
  }));
  personal.command("link").description("Link your personal canvas here with one undoable card")
    .option("--request-id <id>", "reuse this ID only when retrying the same gesture")
    .action(act(async (ctx, [options]) => {
      const canvas = await resolveCanvas(ctx);
      const answer = await ctx.client.linkPersonal(canvas.id, { actorId: ctx.actor.id, requestId: options.requestId ?? newOpId() });
      if (ctx.json) return printJson(answer);
      console.log(`${answer.link.owner.name}'s canvas ${answer.link.linked ? "linked" : "not linked"} as ${answer.link.itemId} at ${answer.link.home}${answer.link.refused ? ` — ${answer.link.refused}` : ""}`);
    }));
  personal.command("links").description("List concrete personal cards and your current availability").action(act(async (ctx) => {
    const canvas = await resolveCanvas(ctx);
    const answer = await ctx.client.personalLinks(canvas.id, ctx.actor.id);
    if (ctx.json) return printJson(answer);
    if (!answer.links.length) return console.log("No personal canvases linked here.");
    for (const link of answer.links) console.log(`${link.itemId} ${link.owner.name}'s canvas — ${link.available ? "available" : link.refused ?? "unavailable"} · ${link.home}`);
  }));
  personal.command("unlink <item>").description("Delete your concrete personal card; ordinary undo restores its consent")
    .option("--request-id <id>", "reuse this ID only when retrying the same gesture")
    .action(act(async (ctx, [itemId, options]) => {
      const canvas = await resolveCanvas(ctx);
      const answer = await ctx.client.unlinkPersonal(canvas.id, { actorId: ctx.actor.id, requestId: options.requestId ?? newOpId(), itemId });
      if (ctx.json) return printJson(answer);
      console.log(`Unlinked ${itemId}. Undo restores the same card and consent.`);
    }));
  personal.command("delegates").description("Inspect agents allowed by the owner of this exact personal dataset")
    .requiredOption("--source <canvas-id>", "the personal dataset whose access list to inspect")
    .action(act(async (ctx, [options]) => {
      const answer = await ctx.client.personalDelegates(options.source, ctx.actor.id);
      if (ctx.json) return printJson(answer);
      for (const one of answer.delegates) console.log(`${one.agentId} ${one.allowed ? "allowed" : "revoked"} ${one.at}`);
      if (!answer.delegates.length) console.log("No agents allowed.");
    }));
  for (const name of ["allow", "revoke"] as const) personal.command(`${name} <agent-id>`)
    .description(`${name === "allow" ? "Allow" : "Revoke"} one agent's personal Context access on this exact dataset`)
    .requiredOption("--source <canvas-id>", "the personal dataset whose owner is granting or revoking access")
    .action(act(async (ctx, [agentId, options]) => {
      const answer = await ctx.client.setPersonalDelegate(options.source, agentId, { actorId: ctx.actor.id, allowed: name === "allow" });
      if (ctx.json) return printJson(answer);
      console.log(`${agentId} ${answer.delegation.allowed ? "allowed" : "revoked"} on ${options.source}. ${name === "revoke" ? "The next personal read rechecks access." : "Reading also requires this source's concrete link on the destination."}`);
    }));
  personal.command("read <item>").description("Read current private pinned context through this exact destination card")
    .option("--cursor <cursor>", "opaque continuation returned by the previous page")
    .option("--limit <pieces>", "contributions per page, 1..64 (default 16)")
    .action(act(async (ctx, [itemId, options]) => {
      const limit = options.limit === undefined ? undefined : Number(options.limit);
      if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0 || limit > 64)) throw new Error("--limit expects a piece count from 1 to 64");
      const canvas = await resolveCanvas(ctx);
      const answer = await ctx.client.readPersonal(canvas.id, { actorId: ctx.actor.id, itemId, mode: "content", ...(options.cursor ? { cursor: options.cursor } : {}), ...(limit !== undefined ? { limit } : {}) });
      if (ctx.json) return printJson(answer);
      console.log(`Private personal context from ${answer.owner.name}'s canvas (${answer.sourceCanvasId}) at ${answer.home}`);
      for (const piece of answer.pieces) console.log(`\n${piece.title}\n${piece.text ?? piece.unavailable ?? `${piece.mimeType ?? "No current version"} — metadata only`}`);
      if (answer.nextCursor) console.log(`\nContinue with --cursor ${answer.nextCursor}`);
      if (answer.truncated) console.log("Response bounded; more context may remain.");
    }));
}
