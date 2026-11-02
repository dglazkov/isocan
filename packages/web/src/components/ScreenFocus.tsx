import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { parse, type DefaultTreeAdapterMap } from "parse5";
import {
  DESIGN_SYSTEM_ROLE,
  isDesignSystem,
  newGroupId,
  newVersionId,
  visualFaceOf,
  type FocusFacts,
  type FocusSubtarget,
  type Item,
  type ItemVersion,
  type ModuleFocus,
} from "@isocan/core";
import { applyCopyDeck, copyDeck, type CopyEdit } from "@isocan/core/copy-deck";
import { TextEditFrame } from "./TextEditFrame.tsx";

export type ScreenViewportId = "mobile" | "tablet" | "desktop" | "fit";

export interface ScreenViewportPreset {
  id: ScreenViewportId;
  label: string;
  width: number | null;
}

export const SCREEN_VIEWPORT_PRESETS: readonly ScreenViewportPreset[] = [
  { id: "mobile", label: "390", width: 390 },
  { id: "tablet", label: "768", width: 768 },
  { id: "desktop", label: "1440", width: 1440 },
  { id: "fit", label: "Fit", width: null },
] as const;

export const SCREEN_STATE_HINTS = ["default", "empty", "loading", "error"] as const;
export type ScreenStateHint = (typeof SCREEN_STATE_HINTS)[number];

export interface DomElementTarget {
  selector: string;
  tag: string;
  label: string;
}

export function isHtmlScreenFocusMatch(item: Item, version: ItemVersion): boolean {
  if (isDesignSystem(item) || item.properties?.role === DESIGN_SYSTEM_ROLE) return false;
  return visualFaceOf(version).mimeType === "text/html";
}

export function domElementSubtargetFor(el: DomElementTarget): FocusSubtarget {
  return {
    kind: "dom-element",
    id: el.selector,
    label: `Element: ${el.label}`,
    metadata: {
      selector: el.selector,
      tag: el.tag,
    },
  };
}

/**
 * Inject `data-state="<state>"` onto `<html>` and `<body>` for interactive
 * state previewing (`default`, `empty`, `loading`, `error`) without altering
 * saved source bytes.
 */
export function injectScreenStatePreview(html: string, state: ScreenStateHint): string {
  if (state === "default" || !html) return html;
  if (/<body\b/i.test(html)) {
    return html.replace(/<body\b([^>]*)>/i, (_m, attrs: string) => {
      const cleaned = attrs.replace(/\sdata-state=(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "");
      return `<body${cleaned} data-state="${state}">`;
    });
  }
  return `<div data-state="${state}">${html}</div>`;
}

type P5Node = DefaultTreeAdapterMap["node"];
type P5Element = DefaultTreeAdapterMap["element"];

const LANDMARK_TAGS = new Set([
  "header",
  "nav",
  "main",
  "section",
  "article",
  "aside",
  "form",
  "footer",
  "button",
  "dialog",
]);

function firstTextSnippet(node: P5Node, maxLen = 36): string {
  let acc = "";
  const walk = (n: P5Node) => {
    if (acc.length >= maxLen) return;
    if (n.nodeName === "#text") {
      const t = (n as DefaultTreeAdapterMap["textNode"]).value.replace(/\s+/g, " ").trim();
      if (t) acc += (acc ? " " : "") + t;
      return;
    }
    const children = ((n as P5Element).childNodes ?? []) as P5Node[];
    for (const c of children) walk(c);
  };
  walk(node);
  return acc.length > maxLen ? `${acc.slice(0, maxLen - 1)}…` : acc;
}

/**
 * Extract addressable DOM landmarks and named elements from HTML so a user in
 * Screen Studio can click an element to anchor Node-Anchored Chat (`kind: "dom-element"`).
 */
export function extractDomElements(html: string, limit = 24): DomElementTarget[] {
  if (!html.trim()) return [];
  const doc = parse(html);
  const out: DomElementTarget[] = [];
  const counts = new Map<string, number>();

  const walk = (node: P5Node) => {
    if (out.length >= limit) return;
    if ("tagName" in node) {
      const el = node as P5Element;
      const tag = String(el.tagName).toLowerCase();
      const idAttr = el.attrs.find((a) => a.name.toLowerCase() === "id")?.value?.trim();
      const testIdAttr = el.attrs
        .find((a) => a.name.toLowerCase() === "data-testid")
        ?.value?.trim();
      const ariaLabel = el.attrs
        .find((a) => a.name.toLowerCase() === "aria-label")
        ?.value?.trim();
      const classAttr = el.attrs
        .find((a) => a.name.toLowerCase() === "class")
        ?.value?.trim()
        ?.split(/\s+/)[0];

      if (idAttr || testIdAttr || LANDMARK_TAGS.has(tag)) {
        const idx = (counts.get(tag) ?? 0) + 1;
        counts.set(tag, idx);
        const selector = idAttr
          ? `#${idAttr}`
          : testIdAttr
            ? `[data-testid="${testIdAttr}"]`
            : classAttr
              ? `${tag}.${classAttr}`
              : `${tag}:nth-of-type(${idx})`;
        const snippet = ariaLabel || firstTextSnippet(el);
        const label = snippet ? `${selector} — "${snippet}"` : selector;
        out.push({ selector, tag, label });
      }
    }
    const children = ((node as P5Element).childNodes ?? []) as P5Node[];
    for (const child of children) walk(child);
  };

  walk(doc);
  return out;
}

/**
 * Apply pending copy-deck edits (`CopyEdit[]`) to `html` and stack a new
 * `ItemVersion` (`item.addVersion`) via `facts.host`.
 */
export async function saveScreenCopyEdits(
  facts: Pick<FocusFacts, "item" | "version" | "host">,
  html: string,
  edits: readonly CopyEdit[],
): Promise<{ ok: true; versionId: string; html: string } | { ok: false; reason: string }> {
  const outcome = applyCopyDeck(html, edits);
  if (!outcome.ok) return outcome;
  const filename = facts.version.filename || "screen.html";
  const uploaded = await facts.host.putBlob(
    new Blob([outcome.html], { type: "text/html" }),
    filename,
  );
  const versionId = newVersionId();
  await facts.host.send(
    [
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
    ],
    newGroupId(),
  );
  return { ok: true, versionId, html: outcome.html };
}

export function ScreenFocusEdit(facts: FocusFacts) {
  const [html, setHtml] = useState<string | null>(null);
  const [viewport, setViewport] = useState<ScreenViewportId>("fit");
  const [stateHint, setStateHint] = useState<ScreenStateHint>("default");
  const [inlineTextEdit, setInlineTextEdit] = useState(false);
  const [copyEdits, setCopyEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const readTextRef = useRef(facts.readText);
  readTextRef.current = facts.readText;

  useEffect(() => {
    let active = true;
    void readTextRef
      .current()
      .then((t) => {
        if (!active) return;
        setHtml(t);
        setCopyEdits({});
      })
      .catch(() => {
        if (active) setHtml("");
      });
    return () => {
      active = false;
    };
  }, [facts.version.blobHash]);

  const deck = useMemo(() => (html ? copyDeck(html) : null), [html]);
  const domElements = useMemo(() => (html ? extractDomElements(html) : []), [html]);

  const previewHtml = useMemo(() => {
    if (!html) return "";
    let working = html;
    if (deck && deck.kind === "html") {
      const pending: CopyEdit[] = [];
      for (const s of deck.strings) {
        const nextVal = copyEdits[s.address];
        if (nextVal !== undefined && nextVal !== s.text) {
          pending.push({ address: s.address, text: s.text, to: nextVal });
        }
      }
      if (pending.length > 0) {
        const applied = applyCopyDeck(working, pending);
        if (applied.ok) working = applied.html;
      }
    }
    return injectScreenStatePreview(working, stateHint);
  }, [html, deck, copyEdits, stateHint]);

  const pendingCopyEdits = useMemo(() => {
    if (!deck || deck.kind !== "html") return [];
    const list: CopyEdit[] = [];
    for (const s of deck.strings) {
      const nextVal = copyEdits[s.address];
      if (nextVal !== undefined && nextVal.trim() !== s.text) {
        list.push({ address: s.address, text: s.text, to: nextVal });
      }
    }
    return list;
  }, [deck, copyEdits]);

  if (html === null) {
    return <div className="page-note">Loading screen studio…</div>;
  }

  if (inlineTextEdit) {
    return (
      <div className="screen-focus-edit" data-testid="screen-focus-inline-edit">
        <TextEditFrame
          key={facts.item.id}
          canvasId={facts.canvasId}
          item={facts.item}
          actor={facts.actor}
          onDone={() => setInlineTextEdit(false)}
        />
      </div>
    );
  }

  const preset =
    SCREEN_VIEWPORT_PRESETS.find((p) => p.id === viewport) ?? SCREEN_VIEWPORT_PRESETS[3]!;

  const onSaveCopy = async () => {
    if (!facts.canEdit || saving || pendingCopyEdits.length === 0) return;
    setSaving(true);
    try {
      const res = await saveScreenCopyEdits(facts, html, pendingCopyEdits);
      if (res.ok) {
        setHtml(res.html);
        setCopyEdits({});
        setStatusMsg(`Stacked version (${res.versionId})`);
      } else {
        setStatusMsg(res.reason);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen-focus-edit" data-testid="screen-focus-edit">
      <div className="screen-focus-toolbar">
        <div className="screen-viewport-group" role="group" aria-label="Viewport width">
          {SCREEN_VIEWPORT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              data-viewport-preset={p.id}
              className={`screen-viewport-btn${viewport === p.id ? " active" : ""}`}
              onClick={() => setViewport(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="screen-state-group" role="group" aria-label="State preview">
          {SCREEN_STATE_HINTS.map((st) => (
            <button
              key={st}
              type="button"
              data-state-toggle={st}
              className={`screen-state-btn${stateHint === st ? " active" : ""}`}
              onClick={() => setStateHint(st)}
            >
              {st}
            </button>
          ))}
        </div>
        {facts.canEdit && (
          <button
            type="button"
            className="screen-inline-edit-btn"
            onClick={() => setInlineTextEdit(true)}
            title="Double-click text in the live frame to edit in place"
          >
            Edit text in place
          </button>
        )}
        <span className="spacer" />
        {statusMsg && (
          <span className="screen-status-note" role="status">
            {statusMsg}
          </span>
        )}
        {pendingCopyEdits.length > 0 && (
          <button
            type="button"
            className="screen-save-copy-btn"
            disabled={!facts.canEdit || saving}
            onClick={() => void onSaveCopy()}
          >
            {saving ? "Saving…" : `Stack Copy (${pendingCopyEdits.length})`}
          </button>
        )}
      </div>

      <div className="screen-focus-body">
        <div className="screen-focus-stage-wrap">
          <div
            className="screen-focus-frame"
            data-viewport-width={preset.width ?? "fit"}
            style={
              preset.width
                ? { width: `${preset.width}px`, maxWidth: "100%" }
                : { width: "100%" }
            }
          >
            <iframe
              className="html-view screen-focus-iframe"
              sandbox="allow-scripts"
              srcDoc={previewHtml}
              title={facts.item.title}
            />
          </div>
        </div>

        <aside className="screen-focus-rail" aria-label="Screen studio inspector">
          <div className="screen-rail-section">
            <div className="screen-rail-head">
              <strong>DOM Elements ({domElements.length})</strong>
              <small>Click to anchor Chat</small>
            </div>
            <div className="screen-dom-list">
              {domElements.map((el) => {
                const active =
                  facts.subtarget?.kind === "dom-element" &&
                  facts.subtarget.id === el.selector;
                return (
                  <button
                    key={el.selector}
                    type="button"
                    data-dom-target={el.selector}
                    className={`screen-dom-chip${active ? " active" : ""}`}
                    onClick={() => facts.setSubtarget(domElementSubtargetFor(el))}
                  >
                    <code>{el.selector}</code>
                    <span>{el.label.replace(`${el.selector} — `, "")}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {deck && deck.kind === "html" && deck.strings.length > 0 && (
            <div className="screen-rail-section">
              <div className="screen-rail-head">
                <strong>Copy Deck ({deck.strings.length})</strong>
                <small>Role & budget</small>
              </div>
              <div className="screen-copy-list">
                {deck.strings.slice(0, 20).map((str) => {
                  const val = copyEdits[str.address] ?? str.text;
                  return (
                    <label key={str.address} className="screen-copy-row">
                      <div className="screen-copy-meta">
                        <span className="screen-copy-role">{str.role}</span>
                        <code>{str.address}</code>
                      </div>
                      <input
                        type="text"
                        aria-label={`Copy ${str.address}`}
                        disabled={!facts.canEdit}
                        value={val}
                        onChange={(e) =>
                          setCopyEdits((prev) => ({
                            ...prev,
                            [str.address]: e.target.value,
                          }))
                        }
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export const screenFocusFacet: ModuleFocus<
  ComponentType<FocusFacts>,
  ComponentType<FocusFacts>
> = {
  id: "builtin.screen",
  priority: 0,
  matches: isHtmlScreenFocusMatch,
  // No `view`: View on an HTML screen is the screen itself, full bleed — a
  // slide or a page needs no viewport chrome, and the floating FocusHeader
  // would sit on top of any bar we drew. The viewport presets and state
  // previews live in Edit, where they are tools rather than furniture.
  edit: ScreenFocusEdit,
  agentPrompts: [
    {
      label: "Polish layout",
      prompt: "Polish spacing, alignment, and visual hierarchy on this screen.",
    },
    {
      label: "Check DESIGN.md",
      prompt: "Align this screen's colors, fonts, and radii with the governing DESIGN.md.",
    },
    {
      label: "Mobile pass",
      prompt: "Ensure this screen adapts cleanly down to a 390px mobile viewport.",
    },
  ],
};
