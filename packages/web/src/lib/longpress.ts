/** One stationary touch may offer a menu; every competing gesture cancels it. */
export function longPress(show: (point: { x: number; y: number; target: EventTarget | null }, current: () => boolean) => void) {
  let fingers = new Set<number>();
  let held: { id: number; x: number; y: number; target: EventTarget | null } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let token = 0;
  let fired = false;
  const cancel = () => { clearTimeout(timer); timer = undefined; held = null; token++; };
  return {
    down(event: { pointerId: number; pointerType: string; clientX: number; clientY: number; target: EventTarget | null }) {
      if (event.pointerType !== "touch") return;
      fingers.add(event.pointerId); cancel(); fired = false;
      if (fingers.size !== 1) return;
      held = { id: event.pointerId, x: event.clientX, y: event.clientY, target: event.target };
      const point = held, mine = token;
      timer = setTimeout(() => { if (held === point && token === mine) { fired = true; show(point, () => token === mine); } }, 550);
    },
    move(event: { pointerId: number; clientX: number; clientY: number }) {
      if (held?.id === event.pointerId && Math.hypot(event.clientX - held.x, event.clientY - held.y) > 8) cancel();
    },
    up(pointerId: number) { fingers.delete(pointerId); cancel(); },
    cancel,
    consumeClick() { const consumed = fired; fired = false; return consumed; },
    dispose() { cancel(); fingers = new Set(); fired = false; },
  };
}
