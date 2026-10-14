/**
 * **A read that answers in time, or is told it failed.**
 *
 * The signal cancels the fetch, but a signal alone is not a deadline: a
 * request can be waiting on something no signal reaches — the door's
 * recovery, a shared re-claim — and an aborted signal nobody checks leaves
 * the caller on "Loading…" for good. So the answer is raced against the
 * clock as well, and the clock always wins at `ms`: the caller hears
 * `message`, whatever the read was waiting on.
 *
 * Its own module, not `api.ts`: the canvas list (a lazy route) is its one
 * caller, and in `api.ts` it rode every first visit's entry chunk.
 */
export function withDeadline<T>(ms: number, message: string, read: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const late = new Error(message);
      controller.abort(late);
      reject(late);
    }, ms);
    read(controller.signal).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err: unknown) => { clearTimeout(timer); reject(err); },
    );
  });
}
