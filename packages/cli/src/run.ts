import type { Command } from "commander";
import { BADGE_ENDED } from "@isocan/core";
import { ApiError, CanvasHandle, resolveCanvas } from "@isocan/api";
import type { Ctx } from "./ctx.ts";

/**
 * **Wrap actions: friendly errors, non-zero exit.** The one wrapper every verb
 * in `main.ts` runs through, in a file of its own so that a command family
 * living beside `main.ts` (`operator.ts`) fails the same way, in the same
 * words, rather than with a second wrapper that disagrees about the prefix.
 */
export function run(fn: (...args: any[]) => Promise<void>) {
  return async (...args: any[]) => {
    try {
      await fn(...args);
    } catch (err) {
      console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
      /**
       * **Ended by the operator: the sentence, and a stop** (operator phase
       * 4; journey 7 step 4). `DaemonRoutes.request` refused to re-badge and
       * threw the home's own words; this adds the one line the home cannot
       * say for this machine — that it will not knock again under this name
       * on its own — so the person reads what happened and what they can do,
       * rather than a bare 401 they might retry.
       */
      if (err instanceof ApiError && err.code === BADGE_ENDED) {
        console.error(
          "This machine's badge was ended by the operator of that home, so it will not knock " +
            "for a new one under your name. You can still open the home as a stranger; " +
            "write to the address above about the rest.",
        );
      }
      process.exitCode = 1;
    }
  };
}

/**
 * **A command family's action: its context, then `run`.** Command families
 * registered beside `main.ts` are handed a `contextOf` rather than reaching
 * for `makeCtx`, and each had grown its own copy of this — resolve the
 * context from commander's trailing `Command`, call the work, and catch —
 * with the catch written out again in every file (cleanup TS-5, 27 Sep 2026:
 * ten of them). Every copy printed the bare message where `run` prints
 * `error: …`, and none said the sentence `run` adds for a badge the operator
 * ended. They resolve here and fail through `run`, so a verb fails in the
 * same words whichever file registered it; `run-wrappers.test.ts` counts the
 * catches that would make an eleventh.
 */
export function withContext(
  contextOf: (cmd: Command) => Promise<Ctx>,
  work: (ctx: Ctx, args: any[]) => Promise<void>,
) {
  return run(async (...args: any[]) => work(await contextOf(args.at(-1) as Command), args));
}

/** `withContext`, then the working canvas — the shape most of those
 * families wanted: a handle on the canvas this invocation resolves to. */
export function onCanvas(
  contextOf: (cmd: Command) => Promise<Ctx>,
  work: (handle: CanvasHandle, ctx: Ctx, args: any[]) => Promise<void>,
) {
  return withContext(contextOf, async (ctx, args) => work(new CanvasHandle(ctx, await resolveCanvas(ctx)), ctx, args));
}
