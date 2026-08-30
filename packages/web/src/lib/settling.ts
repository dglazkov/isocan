import { useEffect, useState } from "react";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { SETTLING_MS, settlingItems } from "./writequeue.ts";

/**
 * **Which items are taking longer than they should.**
 *
 * The optimistic pattern has one honesty problem, and it is not the applying —
 * it is the waiting. A change shown instantly and never confirmed looks
 * exactly like a change that worked, right up until it is lost. So the view
 * has to be able to say "this has not landed yet".
 *
 * **But not straight away.** Under a healthy connection a round trip is tens
 * of milliseconds; marking every change the moment it is made would put a
 * flicker on every gesture, and a signal that fires constantly is one people
 * stop seeing. Waiting `SETTLING_MS` first changes what the mark MEANS: not
 * "this is new" but "this is late". Nobody with a working connection ever sees
 * it; anybody without one sees it exactly where the work is stuck.
 *
 * The ticking is the awkward part and is why this is a hook rather than a
 * selector: lateness is a function of the clock, and nothing re-renders when
 * time passes. So it polls — **but only while there is something unconfirmed
 * to poll about.** A canvas at rest schedules nothing, which matters on a
 * surface that is already animating.
 */
export function useSettling(): Set<string> {
  const queue = useCanvasStore((s) => s.queue);
  const canvas = useCanvasStore((s) => s.canvas);
  const [, tick] = useState(0);

  const waiting = queue.some((write) => write.seq === undefined && !write.refused);
  useEffect(() => {
    if (!waiting) return;
    // Half the threshold, so the mark appears within a reasonable fraction of
    // becoming true rather than up to a full window late.
    const timer = setInterval(() => tick((n) => n + 1), SETTLING_MS / 2);
    return () => clearInterval(timer);
  }, [waiting]);

  return settlingItems(queue, Date.now(), canvas);
}
