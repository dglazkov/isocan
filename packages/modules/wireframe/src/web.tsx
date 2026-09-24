import "../assets/styles.css";
import type { ComponentType } from "react";
import type { DialogFacts, UnderlayFacts, WebModule } from "@isocan/core";
import { WireArrows, cachedSpec } from "./arrows.tsx";
import { PrototypeLight } from "./prototype-light.tsx";
import { wireframeCore } from "./command.ts";
import { WireDialog } from "./dialog.tsx";
import { WireMaybes } from "./maybe-marks.tsx";
import { PROTOTYPE_PROP } from "./prototype.ts";

/**
 * **The web half** (phase 5) — fetched, never bundled into first paint: the
 * shell registers `activation.ts` and imports this only when a person types
 * `/wire` or a canvas has two kept screens to join. It carries the Wireframes
 * dialog (the composer, the prototype, the restyle — the CLI's own code over
 * the dialog's host) and the arrows between kept screens.
 */
/** One underlay slot (its predicate is `activation.ts`'s): the maybe marks, the arrows between kept screens, and a selected prototype's screens lit. */
function WireUnderlay(facts: UnderlayFacts) {
  return (
    <>
      <WireMaybes canvas={facts.canvas} drag={facts.drag} />
      <WireArrows {...facts} />
      <PrototypeLight canvas={facts.canvas} selection={facts.selection} drag={facts.drag} specOf={cachedSpec} />
    </>
  );
}

export const wireframeWeb: WebModule<ComponentType<UnderlayFacts>, never, never, never, never, ComponentType<DialogFacts>> = {
  core: wireframeCore,
  underlays: [WireUnderlay],
  dialogs: [{ id: "wire", title: "Wireframes", component: WireDialog }],
  // ⌘K: find the prototypes on a busy canvas (phase 8) — a door, not a write: it opens `/wire prototypes`.
  actions: [{
    id: "wire-prototypes",
    name: "Find prototypes",
    hint: "select the clickable prototypes on this canvas",
    available: ({ canvas }) => Object.values(canvas.items).some((i) => i.properties?.[PROTOTYPE_PROP] !== undefined),
    opens: "wire",
    args: "prototypes",
  }],
};

export default wireframeWeb;
