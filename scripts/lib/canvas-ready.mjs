/**
 * A mounted canvas is not yet a usable canvas. CanvasSurface mounts its world
 * and controls before the snapshot lands; CanvasArrivalVeil renders the
 * `.canvas-finding` surface over them until the store is ready, then fades out.
 * Observe that surface leaving instead of guessing how long navigation takes.
 * This never removes an overlay or substitutes for a real pointer hit test.
 */
export async function waitForCanvas(b, route, timeoutMs = 8000) {
  return b.ev(`(${canvasReady.toString()})(${JSON.stringify(route)}, ${timeoutMs})`, { timeoutMs: timeoutMs + 1000 });
}

// Self-contained because it runs in the page, whose clock bounds the polling.
// A frozen renderer is separately bounded by the browser helper's CDP deadline.
function canvasReady(route, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = performance.now() + timeoutMs;
    const poll = () => {
      const state = {
        at: location.pathname,
        world: !!document.querySelector(".world"),
        arrival: [...document.querySelectorAll(".canvas-finding")].map((el) => el.className),
      };
      if (state.at === route && state.world && state.arrival.length === 0) {
        resolve(state);
      } else if (performance.now() >= deadline) {
        reject(new Error(`canvas not ready within ${timeoutMs}ms: ${JSON.stringify(state)}`));
      } else {
        setTimeout(poll, Math.min(50, Math.max(1, deadline - performance.now())));
      }
    };
    poll();
  });
}
