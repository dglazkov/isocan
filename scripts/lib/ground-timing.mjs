/** Observe input and sleep in the page's clock, before sending real CDP input. */
export async function observeGroundSleep(b) {
  await b.ev(`(${installGroundClock.toString()})()`);
}

function installGroundClock() {
  window.__journeyGroundClock?.close();
  const canvas = document.querySelector("canvas.ground-canvas");
  if (!canvas) throw new Error("no ground to observe");
  const state = { firstMoveAtMs: null, lastMoveAtMs: null, asleepAtMs: null, moves: 0 };
  const moved = (event) => {
    if (!event.isTrusted) return;
    const now = performance.now();
    state.firstMoveAtMs ??= now;
    state.lastMoveAtMs = now;
    state.asleepAtMs = null;
    state.moves++;
  };
  const observer = new MutationObserver(() => {
    if (state.lastMoveAtMs !== null && canvas.dataset.groundState === "asleep") {
      state.asleepAtMs ??= performance.now();
    }
  });
  observer.observe(canvas, { attributes: true, attributeFilter: ["data-ground-state"] });
  window.addEventListener("pointermove", moved, true);
  window.__journeyGroundClock = {
    state,
    close: () => { observer.disconnect(); window.removeEventListener("pointermove", moved, true); },
  };
}

/** A late host read cannot change when the browser actually fell asleep. */
export async function finishGroundSleep(b, name, boundMs = 3500) {
  const sample = await b.ev(`(${readGroundClock.toString()})()`, { timeoutMs: 7000 });
  if (sample.sleptAfterMs > boundMs) {
    throw new Error(`the ${name} took ${sample.sleptAfterMs}ms to fall asleep — the bound is ${boundMs} (browser input/state clock)`);
  }
  return sample;
}

function readGroundClock() {
  return new Promise((resolve, reject) => {
    const clock = window.__journeyGroundClock;
    if (!clock) return reject(new Error("ground sleep observation was not armed"));
    const deadline = performance.now() + 6000;
    const finish = (error, value) => {
      clock.close();
      delete window.__journeyGroundClock;
      if (error) reject(error); else resolve(value);
    };
    const poll = () => {
      const { firstMoveAtMs, lastMoveAtMs, asleepAtMs, moves } = clock.state;
      if (lastMoveAtMs !== null && asleepAtMs !== null) {
        finish(null, { firstMoveAtMs, lastMoveAtMs, asleepAtMs, moves,
          inputDurationMs: lastMoveAtMs - firstMoveAtMs,
          sleptAfterMs: asleepAtMs - lastMoveAtMs });
      } else if (performance.now() >= deadline) {
        finish(new Error(`ground never slept after trusted input: ${JSON.stringify(clock.state)}`));
      } else setTimeout(poll, 25);
    };
    poll();
  });
}

/** A duration, not N sleeps plus N unmeasured CDP round trips. */
export async function movePointerFor(b, point, durationMs = 3000) {
  const started = performance.now();
  let moves = 0;
  while (performance.now() - started < durationMs) {
    const { x, y } = point(moves++);
    await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none", buttons: 0 }, undefined,
      { timeoutMs: Math.max(1, durationMs - (performance.now() - started)) + 1000 });
    const remaining = durationMs - (performance.now() - started);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(30, remaining)));
  }
  return { moves, dispatchDurationMs: performance.now() - started };
}
