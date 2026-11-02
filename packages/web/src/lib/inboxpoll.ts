import type { InboxResponse } from "@isocan/core";

/** Slow enough to stay cheap on a quiet page; visibility return refreshes immediately. */
export const INBOX_POLL_MS = 30_000;
/** A failed refresh discards stale rows, so a refusal cannot look like old success. */
export interface InboxPollState { data: InboxResponse | null; error: string | null; loading: boolean }

/** One request at a time, only while visible. Every lifecycle owns its own
 * signal, so a hidden tab or old identity cannot publish a late answer. */
export function startInboxPoll(options: {
  /** Claim-healing preparation belongs to this cancellable attempt too. */
  prepare?: (signal: AbortSignal) => Promise<void>;
  read: (signal: AbortSignal) => Promise<InboxResponse>;
  changed: (state: InboxPollState) => void;
  visibility: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
}): { refresh: () => void; stop: () => void } {
  let stopped = false;
  let current: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    current?.abort();
    current = null;
  };
  async function refresh() {
    cancel();
    if (stopped || options.visibility.visibilityState !== "visible") return;
    const aborter = new AbortController();
    current = aborter;
    try {
      const signal = AbortSignal.any([aborter.signal, AbortSignal.timeout(25_000)]);
      if (options.prepare) await options.prepare(signal);
      signal.throwIfAborted();
      const data = await options.read(signal);
      if (!aborter.signal.aborted && !stopped) options.changed({ data, error: null, loading: false });
    } catch (error) {
      if (!aborter.signal.aborted && !stopped) options.changed({
        data: null, loading: false,
        error: error instanceof Error ? error.message : "The inbox could not be read.",
      });
    } finally {
      if (current === aborter && !stopped && options.visibility.visibilityState === "visible") {
        current = null;
        timer = setTimeout(() => void refresh(), INBOX_POLL_MS);
      }
    }
  }
  const visibilityChanged = () => { if (options.visibility.visibilityState === "visible") void refresh(); else cancel(); };
  options.visibility.addEventListener("visibilitychange", visibilityChanged);
  void refresh();
  return {
    refresh: () => void refresh(),
    stop() { stopped = true; cancel(); options.visibility.removeEventListener("visibilitychange", visibilityChanged); },
  };
}
