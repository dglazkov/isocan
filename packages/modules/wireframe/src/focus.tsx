import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import {
  newGroupId,
  newVersionId,
  titleSlug,
  type CanvasContents,
  type FocusFacts,
  type FocusSubtarget,
  type Item,
  type ItemVersion,
  type ModuleFocus,
  type Operation,
} from "@isocan/core";
import { isWire } from "./behind.ts";
import {
  COMPONENTS,
  DENSITY_LEVELS,
  INTENT_BY_ID,
  RECIPES,
  TEMPLATE_IDS,
  component,
  type DensityLevel,
  type IntentId,
  type TemplateId,
} from "./catalog/index.ts";
import type { SlotFill } from "./content/fill.ts";
import { scopeEdit } from "./edit.ts";
import { wiresOn } from "./flow.ts";
import { keptFlowsOf, writePrototype } from "./kept-flows.ts";
import {
  LAYER_LABELS,
  TIER_LABELS,
  applyLayersOnCanvas,
  resolveItemLayers,
} from "./layers.ts";
import type { WirePort } from "./port.ts";
import { readWire, renderWire } from "./render.ts";
import {
  PLATFORM_SIZE,
  POLISH_TOKENS,
  WIRE_LAYER_IDS,
  blockWords,
  recipe,
  wireBy,
  wireSize,
  wireTitle,
  wireframe,
  type PolishToken,
  type WireLayerId,
  type WirePolishPatch,
  type WireSlot,
  type WireSpec,
} from "./spec.ts";
import { explainWireDecision } from "./why.ts";

/**
 * **Wireframe Focus (`ModuleFocus`)** (`docs/projects/node-focus/design.md` §5):
 *
 * - **View Focus (`WireframeFocusView`):** Interactive wireframe stage with
 *   fidelity layer bar (`Wire · System · Low-Fi · High-Fi`), clickable hotspot
 *   count, and toggleable **"Why this layout?"** (`explainWireDecision`)
 *   decision/entropy inspector.
 * - **Edit Focus (`WireframeFocusEdit`):** Wireframe Composer Studio with
 *   archetype/template/density header, `[data-wf]` slot inspector over the
 *   53-component catalog, polish/emphasis/pattern token chips, inline copy &
 *   intent deck, Variations tray, and `FocusSubtarget` (`kind: "wf-slot"`)
 *   anchoring for Node-Anchored Chat.
 */

export function isWireframeFocusMatch(item: Item, version: ItemVersion): boolean {
  return isWire(item) && version.mimeType === "text/html";
}

export function slotSubtargetFor(slot: WireSlot): FocusSubtarget {
  return {
    kind: "wf-slot",
    id: slot.slot,
    label: `Slot: ${slot.slot} (${slot.block ?? "blueprint"})`,
    metadata: {
      slot: slot.slot,
      block: slot.block,
      ...(slot.region ? { region: slot.region } : {}),
    },
  };
}

/**
 * Swap or restore a `[data-wf]` slot's catalog block on `spec` without
 * corrupting any sibling slot, preserving `flow`, `request`, `pinned`, `style`,
 * and `decisions`.
 */
export function applyWireStudioSlotSwap(
  spec: WireSpec,
  slotId: string,
  blockId: string,
): WireSpec {
  const exists = spec.slots.some((s) => s.slot === slotId);
  return scopeEdit(spec, {
    kind: exists ? "variant" : "add",
    slot: slotId,
    block: blockId,
  });
}

/**
 * Remove an optional `[data-wf]` slot from `spec`.
 */
export function applyWireStudioSlotRemove(spec: WireSpec, slotId: string): WireSpec {
  return scopeEdit(spec, {
    kind: "remove",
    slot: slotId,
  });
}

/**
 * Toggle a visual polish / emphasis / pattern token (`POLISH_TOKENS`) on a
 * targeted `slotId` (`data-wf` path).
 */
export function applyWireStudioSlotPolish(
  spec: WireSpec,
  slotId: string,
  token: PolishToken,
): WireSpec {
  const currentPatches: WirePolishPatch[] = [...(spec.polish ?? [])];
  const idx = currentPatches.findIndex((p) => p.target === slotId);
  if (idx < 0) {
    currentPatches.push({ target: slotId, add: [token] });
  } else {
    const existing = currentPatches[idx]!;
    const currentAdd = new Set(existing.add ?? []);
    if (currentAdd.has(token)) {
      currentAdd.delete(token);
    } else {
      currentAdd.add(token);
    }
    const nextAdd = [...currentAdd];
    if (nextAdd.length === 0 && (!existing.remove || existing.remove.length === 0)) {
      currentPatches.splice(idx, 1);
    } else {
      const nextPatch: WirePolishPatch = {
        target: existing.target,
        ...(nextAdd.length > 0 ? { add: nextAdd } : {}),
        ...(existing.remove && existing.remove.length > 0 ? { remove: existing.remove } : {}),
      };
      currentPatches[idx] = nextPatch;
    }
  }
  const next: WireSpec = { ...spec };
  if (currentPatches.length > 0) {
    next.polish = currentPatches;
  } else {
    delete next.polish;
  }
  return next;
}

/**
 * Change archetype, layout template, or spacing density on `spec`.
 */
export function applyWireStudioLayoutChange(
  spec: WireSpec,
  patch: {
    archetype?: string;
    template?: TemplateId;
    density?: DensityLevel;
  },
): WireSpec {
  if (patch.archetype && patch.archetype !== spec.archetype) {
    const chosenTemplate = patch.template ?? spec.template;
    const base = wireframe(patch.archetype, {
      platform: spec.platform,
      ...(chosenTemplate ? { template: chosenTemplate } : {}),
      request: spec.request,
      flow: spec.flow,
      title: spec.title,
    });
    return {
      ...base,
      ...(patch.density ?? spec.density ? { density: (patch.density ?? spec.density)! } : {}),
      ...(spec.style ? { style: spec.style } : {}),
      ...(spec.layers ? { layers: spec.layers } : {}),
      ...(spec.by ? { by: spec.by } : {}),
    };
  }
  const anchorSlot = spec.slots[0]?.slot ?? "main.1";
  return scopeEdit(spec, {
    kind: "restyle",
    slot: anchorSlot,
    ...(patch.template ? { template: patch.template } : {}),
    ...(patch.density ? { density: patch.density } : {}),
  });
}

/**
 * Update a slot's `fill` copy fields (`heading`, `sub`, etc.) on `spec`.
 */
export function applyWireStudioSlotCopy(
  spec: WireSpec,
  slotId: string,
  fill: SlotFill,
): WireSpec {
  return scopeEdit(spec, {
    kind: "content",
    slot: slotId,
    fill,
  });
}

/**
 * Update an actionable element's `IntentId` on a slot.
 */
export function applyWireStudioSlotIntent(
  spec: WireSpec,
  slotId: string,
  element: string,
  intent: IntentId,
): WireSpec {
  return {
    ...spec,
    slots: spec.slots.map((s) =>
      s.slot === slotId
        ? { ...s, intents: { ...(s.intents ?? {}), [element]: intent } }
        : s,
    ),
  };
}

/**
 * Find sibling wireframe variations on the canvas related to `item` / `spec`.
 */
export function wireVariationsFor(
  canvas: CanvasContents,
  item: Item,
  spec: WireSpec,
  readSpecOf?: (other: Item) => WireSpec | null,
): Item[] {
  return Object.values(canvas.items).filter((other) => {
    if (other.id === item.id || !isWire(other)) return false;
    const otherSpec = readSpecOf?.(other);
    if (otherSpec) {
      if (otherSpec.variantOf === item.id || spec.variantOf === other.id) return true;
      if (spec.flow && otherSpec.flow === spec.flow && otherSpec.archetype === spec.archetype) {
        return true;
      }
    }
    return false;
  });
}

function focusWirePort(
  canvasId: string,
  canvas: CanvasContents,
  facts: Pick<FocusFacts, "host" | "actor">,
  readHashText: (blobHash: string) => Promise<string>,
): WirePort {
  return {
    canvasId,
    actor: facts.actor ? { id: facts.actor.id, name: facts.actor.name } : undefined,
    canvas: async () => canvas,
    readText: readHashText,
    put: (text, mimeType, filename) =>
      facts.host.putBlob(new Blob([text], { type: mimeType }), filename),
    send: async (op, group) => {
      await facts.host.send([op], group);
    },
  };
}

/**
 * Render `nextSpec` via `renderWire`, upload the HTML blob, stack an
 * `item.addVersion` op (plus `item.resize` / `item.update` when dimensions or
 * title changed), and rebuild any affected flow prototype in the same op group.
 */
export async function saveWireStudioSpec(
  facts: Pick<FocusFacts, "canvasId" | "canvas" | "item" | "version" | "actor" | "host" | "readText">,
  nextSpec: WireSpec,
  previousSpec?: WireSpec | null,
): Promise<{ versionId: string; blobHash: string; html: string; group: string }> {
  const stamped: WireSpec = {
    ...nextSpec,
    by: wireBy(nextSpec.by?.model ?? nextSpec.by?.answerer ?? "agent", {
      id: facts.actor.id,
      name: facts.actor.name,
    }),
  };
  const html = renderWire(stamped);
  const title = wireTitle(stamped);
  const filename = facts.version.filename || `${titleSlug(title, { max: 60 }) || "screen"}.html`;
  const uploaded = await facts.host.putBlob(
    new Blob([html], { type: "text/html" }),
    filename,
  );
  const versionId = newVersionId();
  const group = newGroupId();
  const ops: Operation[] = [
    {
      type: "item.addVersion",
      itemId: facts.item.id,
      version: {
        id: versionId,
        blobHash: uploaded.blobHash,
        mimeType: "text/html",
        filename,
        size: uploaded.size,
      },
    },
  ];
  const { width, height } = wireSize(stamped);
  if (width !== facts.item.width || height !== facts.item.height) {
    ops.push({
      type: "item.resize",
      itemId: facts.item.id,
      width,
      height,
    });
  }
  if (previousSpec && facts.item.title === wireTitle(previousSpec) && title !== wireTitle(previousSpec)) {
    ops.push({
      type: "item.update",
      itemId: facts.item.id,
      patch: { title },
    });
  }
  await facts.host.send(ops, group);

  // If the screen belongs to a kept flow and we can read text blobs, rebuild its prototype
  if (stamped.flow) {
    try {
      const port = focusWirePort(facts.canvasId, facts.canvas, facts, async (hash) => {
        if (hash === uploaded.blobHash) return html;
        if (hash === facts.version.blobHash) return facts.readText();
        return "";
      });
      const all = await wiresOn(port, facts.canvas);
      const updatedScreens = all.map((s) =>
        s.item === facts.item.id ? { ...s, spec: stamped, width, height } : s,
      );
      const kept = keptFlowsOf(facts.canvas, updatedScreens);
      const affected = kept.find((f) => f.items.some((i) => i.id === facts.item.id));
      if (affected) {
        await writePrototype(port, facts.canvas, affected, group);
      }
    } catch {
      // Prototype rebuild is best-effort inside FocusFacts when other blobs are remote.
    }
  }

  return { versionId, blobHash: uploaded.blobHash, html, group };
}

export function WireframeFocusView(facts: FocusFacts) {
  const [html, setHtml] = useState<string | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [busyLayer, setBusyLayer] = useState(false);
  const readTextRef = useRef(facts.readText);
  readTextRef.current = facts.readText;

  useEffect(() => {
    let active = true;
    void readTextRef
      .current()
      .then((text) => {
        if (active) setHtml(text);
      })
      .catch(() => {
        if (active) setHtml("");
      });
    return () => {
      active = false;
    };
  }, [facts.version.blobHash]);

  const spec = useMemo(() => (html ? readWire(html) : null), [html]);
  const resolved = useMemo(
    () => resolveItemLayers(facts.item, spec),
    [facts.item, spec],
  );
  const explanation = useMemo(
    () => (spec ? explainWireDecision(spec) : null),
    [spec],
  );

  if (html === null) {
    return <div className="page-note">Loading wireframe…</div>;
  }

  if (!spec) {
    return (
      <div className="wf-focus-view" data-testid="wireframe-focus-view-fallback">
        <iframe
          className="html-view"
          sandbox="allow-scripts"
          srcDoc={html}
          title={facts.item.title}
        />
      </div>
    );
  }

  const frameSize = PLATFORM_SIZE[spec.platform];
  const hotspotCount = spec.slots.reduce(
    (sum, s) => sum + Object.keys(s.intents ?? {}).length,
    0,
  );
  const tierInfo = TIER_LABELS[resolved.tier];

  const onToggleLayer = async (layerId: WireLayerId) => {
    if (!facts.canEdit || busyLayer) return;
    setBusyLayer(true);
    try {
      const port = focusWirePort(facts.canvasId, facts.canvas, facts, async (hash) =>
        hash === facts.version.blobHash ? html : "",
      );
      const targetScreen = {
        item: facts.item.id,
        spec,
        x: facts.item.x,
        y: facts.item.y,
        width: facts.item.width,
        height: facts.item.height,
      };
      await applyLayersOnCanvas(
        port,
        facts.canvas,
        [targetScreen],
        [targetScreen],
        `toggle:${layerId}`,
      );
    } finally {
      setBusyLayer(false);
    }
  };

  return (
    <div className="wf-focus-view" data-testid="wireframe-focus-view">
      <div className="wf-focus-toolbar">
        <span className="wf-focus-badge" title={`${tierInfo.title} — ${tierInfo.summary}`}>
          ◧ {tierInfo.badge}
        </span>
        <div className="wf-focus-layer-group" role="group" aria-label="Fidelity layers">
          {WIRE_LAYER_IDS.map((id) => {
            const checked = resolved[id];
            const info = LAYER_LABELS[id];
            return (
              <button
                key={id}
                type="button"
                role="checkbox"
                aria-checked={checked}
                disabled={!facts.canEdit || busyLayer}
                className={`wf-focus-layer-chip${checked ? " active" : ""}`}
                title={`${info.label}: ${info.hint}`}
                onClick={() => void onToggleLayer(id)}
              >
                {checked ? "✓ " : ""}
                {info.short}
              </button>
            );
          })}
        </div>
        <span className="wf-focus-meta">
          {spec.archetype} · {spec.platform} ({frameSize.width}×{frameSize.height}) ·{" "}
          {hotspotCount} hotspot{hotspotCount === 1 ? "" : "s"}
        </span>
        <span className="spacer" />
        <button
          type="button"
          className={`wf-focus-why-btn${whyOpen ? " active" : ""}`}
          aria-expanded={whyOpen}
          onClick={() => setWhyOpen((v) => !v)}
        >
          Why this layout?
        </button>
      </div>
      <div className="wf-focus-body">
        <div className="wf-focus-stage-wrap">
          <div
            className="wf-focus-device-frame"
            style={{ width: frameSize.width, maxWidth: "100%" }}
          >
            <iframe
              className="html-view wf-focus-iframe"
              sandbox="allow-scripts"
              srcDoc={html}
              title={facts.item.title}
            />
          </div>
        </div>
        {whyOpen && explanation && (
          <aside
            className="wf-focus-why-rail"
            aria-label="Wireframe layout decisions"
            data-testid="wireframe-why-rail"
          >
            <div className="wf-focus-rail-head">
              <strong>Why this layout?</strong>
              <span>by {explanation.by}</span>
            </div>
            <p className="wf-focus-why-summary">
              Archetype <code>{explanation.archetype}</code> on{" "}
              <code>{explanation.platform}</code>
              {explanation.template ? (
                <>
                  {" "}
                  · template <code>{explanation.template}</code>
                </>
              ) : null}
              {explanation.density ? (
                <>
                  {" "}
                  · density <code>{explanation.density}</code>
                </>
              ) : null}
              {explanation.need !== undefined ? (
                <> · need P(yes)={Math.round(explanation.need * 100)}%</>
              ) : null}
            </p>
            <ul className="wf-focus-why-slots">
              {explanation.slots.map((row) => (
                <li key={row.slot} className="wf-focus-why-slot">
                  <div className="wf-focus-why-slot-head">
                    <code>{row.slot}</code>
                    <strong>{row.block ?? "blueprint"}</strong>
                    {row.p !== undefined && (
                      <span className="wf-focus-prob">
                        {Math.round(row.p * 100)}%
                      </span>
                    )}
                    {row.entropy !== undefined && (
                      <span className="wf-focus-entropy" title="Shannon entropy in bits">
                        H={row.entropy.toFixed(2)}b
                      </span>
                    )}
                  </div>
                  {row.alternatives.length > 0 && (
                    <div className="wf-focus-why-alts">
                      Runners-up:{" "}
                      {row.alternatives
                        .map((a) => `${a.block} (${Math.round(a.p * 100)}%)`)
                        .join(", ")}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {explanation.declined.length > 0 && (
              <div className="wf-focus-why-declined">
                <strong>Declined optional sections</strong>
                <ul>
                  {explanation.declined.map((d) => (
                    <li key={d.slot}>
                      <code>{d.slot}</code> ({d.block}, P(omit)={Math.round(d.p * 100)}%)
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

export function WireframeFocusEdit(facts: FocusFacts) {
  const [sourceHtml, setSourceHtml] = useState<string | null>(null);
  const [draftSpec, setDraftSpec] = useState<WireSpec | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const readTextRef = useRef(facts.readText);
  readTextRef.current = facts.readText;

  useEffect(() => {
    let active = true;
    void readTextRef
      .current()
      .then((text) => {
        if (!active) return;
        setSourceHtml(text);
        const parsed = readWire(text);
        setDraftSpec(parsed);
        if (parsed && parsed.slots.length > 0) {
          setSelectedSlotId((prev) =>
            prev && parsed.slots.some((s) => s.slot === prev)
              ? prev
              : parsed.slots[0]!.slot,
          );
        }
      })
      .catch(() => {
        if (active) setSourceHtml("");
      });
    return () => {
      active = false;
    };
  }, [facts.version.blobHash]);

  const savedSpec = useMemo(
    () => (sourceHtml ? readWire(sourceHtml) : null),
    [sourceHtml],
  );
  const renderedDraftHtml = useMemo(
    () => (draftSpec ? renderWire(draftSpec) : sourceHtml ?? ""),
    [draftSpec, sourceHtml],
  );
  const dirty = useMemo(() => {
    if (!draftSpec || !savedSpec) return false;
    return JSON.stringify(draftSpec) !== JSON.stringify(savedSpec);
  }, [draftSpec, savedSpec]);

  const variations = useMemo(
    () => (draftSpec ? wireVariationsFor(facts.canvas, facts.item, draftSpec) : []),
    [facts.canvas, facts.item, draftSpec],
  );

  if (sourceHtml === null) {
    return <div className="page-note">Loading wireframe studio…</div>;
  }

  if (!draftSpec) {
    return (
      <div className="wf-focus-edit" data-testid="wireframe-focus-edit-fallback">
        <div className="page-note">
          This screen carries no embedded <code>WireSpec</code>; use the Code pane to edit raw HTML.
        </div>
      </div>
    );
  }

  const r = recipe(draftSpec.archetype);
  const selectedSlot =
    draftSpec.slots.find((s) => s.slot === selectedSlotId) ?? draftSpec.slots[0] ?? null;
  const selectedSection = selectedSlot
    ? r.sections.find((sec) => sec.slot === selectedSlot.slot) ?? null
    : null;
  const activePolishTokens = new Set<PolishToken>(
    draftSpec.polish?.find((p) => p.target === selectedSlot?.slot)?.add ?? [],
  );
  const frameSize = PLATFORM_SIZE[draftSpec.platform];

  const selectSlot = (slot: WireSlot) => {
    setSelectedSlotId(slot.slot);
    facts.setSubtarget(slotSubtargetFor(slot));
  };

  const onSwapBlock = (slotId: string, blockId: string) => {
    const next = applyWireStudioSlotSwap(draftSpec, slotId, blockId);
    setDraftSpec(next);
    setSelectedSlotId(slotId);
    const updatedSlot = next.slots.find((s) => s.slot === slotId);
    if (updatedSlot) {
      facts.setSubtarget(slotSubtargetFor(updatedSlot));
    }
    setStatusNote(`Slot ${slotId} → ${blockId}`);
  };

  const onRemoveOptionalSlot = (slotId: string) => {
    const next = applyWireStudioSlotRemove(draftSpec, slotId);
    setDraftSpec(next);
    const fallback = next.slots[0] ?? null;
    setSelectedSlotId(fallback?.slot ?? null);
    facts.setSubtarget(fallback ? slotSubtargetFor(fallback) : null);
    setStatusNote(`Removed optional slot ${slotId}`);
  };

  const onTogglePolish = (slotId: string, token: PolishToken) => {
    const next = applyWireStudioSlotPolish(draftSpec, slotId, token);
    setDraftSpec(next);
    setStatusNote(`Toggled ${token} on ${slotId}`);
  };

  const onSaveVersion = async () => {
    if (!facts.canEdit || saving) return;
    setSaving(true);
    try {
      const res = await saveWireStudioSpec(facts, draftSpec, savedSpec);
      setSourceHtml(res.html);
      setStatusNote(`Stacked wireframe version (${res.versionId})`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wf-focus-edit" data-testid="wireframe-focus-edit">
      <div className="wf-focus-toolbar">
        <label className="wf-studio-field">
          <span>Archetype</span>
          <select
            aria-label="Wireframe archetype"
            value={draftSpec.archetype}
            disabled={!facts.canEdit}
            onChange={(e) =>
              setDraftSpec(
                applyWireStudioLayoutChange(draftSpec, { archetype: e.target.value }),
              )
            }
          >
            {RECIPES.map((rec) => (
              <option key={rec.id} value={rec.id}>
                {rec.title} ({rec.id})
              </option>
            ))}
          </select>
        </label>
        <label className="wf-studio-field">
          <span>Template</span>
          <select
            aria-label="Layout template"
            value={draftSpec.template ?? "single"}
            disabled={!facts.canEdit}
            onChange={(e) =>
              setDraftSpec(
                applyWireStudioLayoutChange(draftSpec, {
                  template: e.target.value as TemplateId,
                }),
              )
            }
          >
            {TEMPLATE_IDS.map((tpl) => (
              <option key={tpl} value={tpl}>
                {tpl}
              </option>
            ))}
          </select>
        </label>
        <label className="wf-studio-field">
          <span>Density</span>
          <select
            aria-label="Spacing density"
            value={draftSpec.density ?? "default"}
            disabled={!facts.canEdit}
            onChange={(e) =>
              setDraftSpec(
                applyWireStudioLayoutChange(draftSpec, {
                  density: e.target.value as DensityLevel,
                }),
              )
            }
          >
            {DENSITY_LEVELS.map((den) => (
              <option key={den} value={den}>
                {den}
              </option>
            ))}
          </select>
        </label>
        <span className="spacer" />
        {statusNote && (
          <span className="wf-studio-status" role="status">
            {statusNote}
          </span>
        )}
        <button
          type="button"
          className="wf-studio-save-btn"
          disabled={!facts.canEdit || saving || !dirty}
          onClick={() => void onSaveVersion()}
        >
          {saving ? "Saving…" : dirty ? "Stack Version" : "Saved"}
        </button>
      </div>

      <div className="wf-studio-slot-strip" role="tablist" aria-label="Wireframe slots">
        {draftSpec.slots.map((slot) => {
          const active = selectedSlot?.slot === slot.slot;
          return (
            <button
              key={slot.slot}
              type="button"
              role="tab"
              aria-selected={active}
              data-slot-chip={slot.slot}
              className={`wf-studio-slot-chip${active ? " active" : ""}`}
              onClick={() => selectSlot(slot)}
            >
              <code>{slot.slot}</code>
              <span>{slot.block ?? "blueprint"}</span>
            </button>
          );
        })}
        {r.sections
          .filter((sec) => sec.optional && !draftSpec.slots.some((s) => s.slot === sec.slot))
          .map((sec) => (
            <button
              key={sec.slot}
              type="button"
              className="wf-studio-slot-chip declined"
              disabled={!facts.canEdit}
              title={`Restore optional section ${sec.slot} (${sec.options[0]})`}
              onClick={() => onSwapBlock(sec.slot, sec.options[0]!)}
            >
              + {sec.slot}
            </button>
          ))}
      </div>

      <div className="wf-focus-body">
        <div className="wf-focus-stage-wrap">
          <div
            className="wf-focus-device-frame"
            style={{ width: frameSize.width, maxWidth: "100%" }}
          >
            <iframe
              className="html-view wf-focus-iframe"
              sandbox="allow-scripts"
              srcDoc={renderedDraftHtml}
              title={`draft of ${facts.item.title}`}
            />
          </div>
        </div>

        <aside className="wf-studio-inspector" aria-label="Wireframe slot inspector">
          {selectedSlot ? (
            <>
              <div className="wf-studio-inspector-head">
                <div>
                  <strong>Slot {selectedSlot.slot}</strong>
                  <div className="wf-studio-inspector-sub">
                    {selectedSlot.block ? blockWords(selectedSlot.block) : "Undecided blueprint"}
                    {selectedSlot.region ? ` · region: ${selectedSlot.region}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  className="wf-studio-ask-btn"
                  onClick={() => {
                    facts.setSubtarget(slotSubtargetFor(selectedSlot));
                    facts.askAgent(
                      `Refine wireframe slot ${selectedSlot.slot} (${selectedSlot.block ?? "blueprint"})`,
                    );
                  }}
                >
                  Ask Agent
                </button>
              </div>

              <div className="wf-studio-section">
                <div className="wf-studio-section-title">
                  Catalog Block ({selectedSection ? selectedSection.options.length : COMPONENTS.size} options)
                </div>
                <div className="wf-studio-block-grid">
                  {(selectedSection ? selectedSection.options : [...COMPONENTS.keys()]).map(
                    (blockId) => {
                      const comp = COMPONENTS.get(blockId);
                      const chosen = selectedSlot.block === blockId;
                      const altProb = selectedSlot.alternatives?.find(
                        (a) => a.block === blockId,
                      )?.p;
                      return (
                        <button
                          key={blockId}
                          type="button"
                          data-block-option={blockId}
                          disabled={!facts.canEdit}
                          className={`wf-studio-block-card${chosen ? " active" : ""}`}
                          onClick={() => onSwapBlock(selectedSlot.slot, blockId)}
                        >
                          <span className="wf-studio-block-name">{blockWords(blockId)}</span>
                          <span className="wf-studio-block-meta">
                            {comp?.category ?? "block"}
                            {altProb !== undefined
                              ? ` · ${Math.round(altProb * 100)}%`
                              : chosen && selectedSlot.p !== undefined
                                ? ` · ${Math.round(selectedSlot.p * 100)}%`
                                : ""}
                          </span>
                        </button>
                      );
                    },
                  )}
                </div>
                {selectedSection?.optional && (
                  <button
                    type="button"
                    className="wf-studio-remove-slot-btn"
                    disabled={!facts.canEdit}
                    onClick={() => onRemoveOptionalSlot(selectedSlot.slot)}
                  >
                    Remove optional section ({selectedSlot.slot})
                  </button>
                )}
              </div>

              <div className="wf-studio-section">
                <div className="wf-studio-section-title">Emphasis & Polish Tokens</div>
                <div className="wf-studio-chip-row">
                  {POLISH_TOKENS.map((token) => {
                    const active = activePolishTokens.has(token);
                    return (
                      <button
                        key={token}
                        type="button"
                        data-polish-token={token}
                        disabled={!facts.canEdit}
                        className={`wf-studio-polish-chip${active ? " active" : ""}`}
                        onClick={() => onTogglePolish(selectedSlot.slot, token)}
                      >
                        {token.replace(/^wf-/, "")}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="wf-studio-section">
                <div className="wf-studio-section-title">Slot Copy & Fill</div>
                <label className="wf-studio-input-row">
                  <span>Heading</span>
                  <input
                    type="text"
                    aria-label="Slot heading"
                    disabled={!facts.canEdit}
                    value={selectedSlot.fill?.heading ?? ""}
                    placeholder="Optional heading override…"
                    onChange={(e) =>
                      setDraftSpec(
                        applyWireStudioSlotCopy(draftSpec, selectedSlot.slot, {
                          ...(selectedSlot.fill ?? {}),
                          heading: e.target.value,
                        }),
                      )
                    }
                  />
                </label>
                <label className="wf-studio-input-row">
                  <span>Subhead</span>
                  <input
                    type="text"
                    aria-label="Slot subhead"
                    disabled={!facts.canEdit}
                    value={selectedSlot.fill?.sub ?? ""}
                    placeholder="Optional subhead override…"
                    onChange={(e) =>
                      setDraftSpec(
                        applyWireStudioSlotCopy(draftSpec, selectedSlot.slot, {
                          ...(selectedSlot.fill ?? {}),
                          sub: e.target.value,
                        }),
                      )
                    }
                  />
                </label>
              </div>

              {selectedSlot.block &&
                (() => {
                  const comp = component(selectedSlot.block);
                  const elements = Object.entries(comp.elements ?? {});
                  if (elements.length === 0) return null;
                  return (
                    <div className="wf-studio-section">
                      <div className="wf-studio-section-title">Hotspot Intents</div>
                      {elements.map(([elId, elDef]) => {
                        const currentIntent =
                          selectedSlot.intents?.[elId] ?? elDef.default;
                        return (
                          <label key={elId} className="wf-studio-input-row">
                            <span>{elId}</span>
                            <select
                              aria-label={`Intent for ${elId}`}
                              disabled={!facts.canEdit}
                              value={currentIntent}
                              onChange={(e) =>
                                setDraftSpec(
                                  applyWireStudioSlotIntent(
                                    draftSpec,
                                    selectedSlot.slot,
                                    elId,
                                    e.target.value as IntentId,
                                  ),
                                )
                              }
                            >
                              {elDef.accepts.map((intentId) => (
                                <option key={intentId} value={intentId}>
                                  {INTENT_BY_ID.get(intentId)?.label ?? intentId} ({intentId})
                                </option>
                              ))}
                            </select>
                          </label>
                        );
                      })}
                    </div>
                  );
                })()}

              {variations.length > 0 && (
                <div className="wf-studio-section" data-testid="wireframe-variations-tray">
                  <div className="wf-studio-section-title">
                    Variations in Flow ({variations.length})
                  </div>
                  <ul className="wf-studio-variations-list">
                    {variations.map((v) => (
                      <li key={v.id}>
                        <span>{v.title}</span>
                        <code>{v.id}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="page-note">Select a wireframe slot to inspect it.</div>
          )}
        </aside>
      </div>
    </div>
  );
}

export const wireframeFocusFacet: ModuleFocus<
  ComponentType<FocusFacts>,
  ComponentType<FocusFacts>
> = {
  id: "module.wireframe",
  priority: 20,
  matches: isWireframeFocusMatch,
  view: WireframeFocusView,
  edit: WireframeFocusEdit,
  agentPrompts: [
    {
      label: "Swap section",
      prompt: "Replace the selected wireframe slot with a clearer catalog block.",
    },
    {
      label: "Tighten copy",
      prompt: "Rewrite the wireframe copy so every CTA and heading is specific.",
    },
    {
      label: "Polish hierarchy",
      prompt: "Apply visual polish tokens to emphasize the primary call-to-action.",
    },
  ],
};
