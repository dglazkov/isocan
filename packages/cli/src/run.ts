import { BADGE_ENDED } from "@isocan/core";
import { ApiError } from "@isocan/api";

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
      console.error(`error: ${(err as Error).message}`);
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
