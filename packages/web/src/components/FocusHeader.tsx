/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import "./focus.css";
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  DECK_TRANSITIONS,
  deckTransitionHint,
  deckTransitionLabel,
  deckTransitionOf,
  deckTransitionPatch,
  isDeckTransition3d,
  itemPath,
  nodeCapabilitiesFor,
  shortcut,
  workbenchItemPath,
  type Actor,
  type DeckTransition,
  type Item,
} from "@isocan/core";
import { CanvasPresence, CanvasTitle, ShareButton } from "./CanvasCrumb.tsx";
import { KindIcon } from "./KindIcon.tsx";
import { DesignSystemsButton } from "./DesignSystemsButton.tsx";
import { iconKindFor } from "../lib/kinds.ts";
import { useCanEdit } from "../lib/capability.ts";
import { sendEchoed, useCanvasStore } from "../stores/canvasStore.ts";
import { useFocusStore } from "../stores/focusStore.ts";
import { itemThreadsFor } from "../lib/nodechat.ts";
import { actorNameIn, useActorNames } from "../lib/names.ts";
import { useTransitionsOn } from "../lib/deckflip.ts";
/** Loaded the first time the Transition menu opens — nobody else pays for it. */
const TransitionPreview = lazy(() => import("./TransitionPreview.tsx"));

/** Width tier of the focus header, measured on the bar itself so split panes
 *  and sidecars adapt the same way a narrow browser window does. */
export type HeaderDensity = "wide" | "medium" | "compact" | "tight";

export function headerDensityFor(width: number): HeaderDensity {
  if (width >= 1360) return "wide";
  if (width >= 1020) return "medium";
  if (width >= 760) return "compact";
  return "tight";
}

/** True when a version filename is just a slugified copy of the item's title
 *  (e.g. `03-what-a-person-clicks.html` beside `03 · What a person clicks`).
 *  Showing both in the header wastes a quarter of the bar on the same words. */
export function isFilenameRedundant(title: string, filename: string): boolean {
  const stem = filename.replace(/\.[^.]+$/, "");
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const a = norm(title);
  const b = norm(stem);
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

export interface FocusHeaderProps {
  canvasId: string;
  item: Item | null;
  mode: "view" | "edit";
  actor: Actor;
  onIdentity: (actor: Actor | null) => void;
  onBack: () => void;
  /** Optional center status pill (e.g., Workbench follow banner). */
  centerAddon?: ReactNode;
  /** View-mode speaker notes toggle state & handler. */
  presenterNotes?: boolean;
  onToggleNotes?: () => void;
  /** Full screen's deck turning itself: on or off, and how many seconds a
   *  slide stays. Present only where a deck is being presented. */
  autoAdvance?: {
    on: boolean;
    seconds: number;
    onToggle: () => void;
    onSeconds: (seconds: number) => void;
  };
}

/**
 * Shared top header for View Focus (`itemPath`) and Edit Focus
 * (`workbenchItemPath`) (`docs/projects/node-focus/design.md` §3).
 *
 * Unifies:
 * - `← Canvas` (`Esc`) + `CanvasTitle`
 * - Editable node title + version pill (`vN`) with version switcher
 * - **`[ View | Edit ]`** mode switch
 * - **`💬 Chat (⌘J)`** toggle for the Node-Anchored Chat Drawer
 */
export function FocusHeader({
  canvasId,
  item,
  mode,
  actor,
  onIdentity,
  onBack,
  centerAddon,
  presenterNotes,
  onToggleNotes,
  autoAdvance,
}: FocusHeaderProps) {
  const navigate = useNavigate();
  const canEdit = useCanEdit();
  const threads = useCanvasStore((s) => s.canvas?.threads);
  const deckTransition = useCanvasStore((s) => deckTransitionOf(s.record ?? {}));
  // The choice is offered only with Presentation Transitions on (`lib/deckflip.ts`).
  const transitionsOn = useTransitionsOn();
  const names = useActorNames();
  const chatOpen = useFocusStore((s) => s.chatOpen);
  const toggleChat = useFocusStore((s) => s.toggleChat);
  const setChatOpen = useFocusStore((s) => s.setChatOpen);

  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState(item?.title ?? "");
  const [versionsOpen, setVersionsOpen] = useState(false);
  const versionWrapRef = useRef<HTMLSpanElement>(null);
  const [transitionsOpen, setTransitionsOpen] = useState(false);
  /** The row the preview is playing — the pointer's or the keyboard's. */
  const [previewed, setPreviewed] = useState<DeckTransition | null>(null);
  const transitionListRef = useRef<HTMLDivElement>(null);
  const transitionWrapRef = useRef<HTMLSpanElement>(null);
  const [deckMenuOpen, setDeckMenuOpen] = useState(false);
  const deckMenuWrapRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [density, setDensity] = useState<HeaderDensity>(() =>
    headerDensityFor(typeof window !== "undefined" ? window.innerWidth : 1440),
  );

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setDensity(headerDensityFor(w));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const compactDeck = density === "compact" || density === "tight";

  useEffect(() => {
    if (!compactDeck) setDeckMenuOpen(false);
  }, [compactDeck]);

  useEffect(() => {
    if (!deckMenuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (deckMenuWrapRef.current && !deckMenuWrapRef.current.contains(e.target as Node)) {
        setDeckMenuOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setDeckMenuOpen(false);
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [deckMenuOpen]);

  useEffect(() => {
    setRenaming(false);
    setTitleDraft(item?.title ?? "");
    setVersionsOpen(false);
  }, [item?.id, item?.title]);

  useEffect(() => {
    if (!versionsOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (versionWrapRef.current && !versionWrapRef.current.contains(e.target as Node)) {
        setVersionsOpen(false);
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [versionsOpen]);

  useEffect(() => {
    if (!transitionsOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (transitionWrapRef.current && !transitionWrapRef.current.contains(e.target as Node)) {
        setTransitionsOpen(false);
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    // Open on the current choice, with the keyboard already in the list, so
    // the arrows walk the rows (and the preview) rather than the deck.
    setPreviewed(null);
    transitionListRef.current?.querySelector<HTMLButtonElement>("[aria-checked=true]")?.focus();
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [transitionsOpen]);

  const currentVersion =
    item?.versions.find((v) => v.id === item.currentVersionId) ?? item?.versions[0];
  const caps = useMemo(
    () => (item ? nodeCapabilitiesFor(item, currentVersion) : null),
    [item, currentVersion],
  );
  const itemId = item?.id ?? null;
  const anchoredThreads = useMemo(
    () => (itemId && threads ? itemThreadsFor(useCanvasStore.getState().canvas, itemId) : []),
    [threads, itemId],
  );
  const anchoredMessageCount = anchoredThreads.reduce((sum, t) => sum + t.comments.length, 0);

  async function commitRename() {
    setRenaming(false);
    if (!item || !canEdit) return;
    const next = titleDraft.trim();
    if (!next || next === item.title) {
      setTitleDraft(item.title);
      return;
    }
    await sendEchoed(canvasId, actor, {
      type: "item.update",
      itemId: item.id,
      patch: { title: next },
    });
  }

  async function promoteVersion(versionId: string) {
    if (!item || !canEdit || versionId === item.currentVersionId) {
      setVersionsOpen(false);
      return;
    }
    setVersionsOpen(false);
    await sendEchoed(canvasId, actor, {
      type: "item.setCurrentVersion",
      itemId: item.id,
      versionId,
    });
  }

  const barClass = `${mode === "view" ? "fs-bar" : "wb-bar"} focus-header`;
  const showFilename =
    mode === "view" &&
    density === "wide" &&
    Boolean(currentVersion?.filename) &&
    !(item && currentVersion?.filename && isFilenameRedundant(item.title, currentVersion.filename));
  const hasTransitionControl = mode === "view" && Boolean(onToggleNotes) && canEdit && transitionsOn;
  const hasDeckControls = mode === "view" && Boolean(autoAdvance || onToggleNotes || hasTransitionControl);
  const deckControlActive = Boolean(autoAdvance?.on || presenterNotes);

  return (
    <div className={barClass} ref={barRef} data-density={density}>
      <div className="floats fs-cluster focus-header-left">
        <button
          className="fullscreen-back"
          onClick={onBack}
          aria-label="Back to the canvas"
          title="Back to the canvas (Esc)"
        >
          ←<span className="focus-back-label"> Canvas</span>
        </button>
        <CanvasTitle actor={actor} />
        {item && <span className="focus-crumb-sep" aria-hidden="true">/</span>}
        {item && (
          <span className="fullscreen-title">
            <KindIcon className="kind-icon" kind={iconKindFor(item)} />
            {canEdit && renaming ? (
              <input
                className="focus-title-input"
                value={titleDraft}
                autoFocus
                aria-label="Item title"
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => void commitRename()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void commitRename();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    setTitleDraft(item.title);
                    setRenaming(false);
                  }
                }}
              />
            ) : canEdit ? (
              <button
                type="button"
                className="focus-title-btn"
                title={`${item.title} — click to rename`}
                onClick={() => {
                  setTitleDraft(item.title);
                  setRenaming(true);
                }}
              >
                <b>{item.title}</b>
              </button>
            ) : (
              <b title={item.title}>{item.title}</b>
            )}
            {showFilename && currentVersion?.filename && (
              <i title={currentVersion.filename}>{currentVersion.filename}</i>
            )}
            {item.versions.length > 0 && (
              <span className="focus-version-wrap" ref={versionWrapRef}>
                <button
                  type="button"
                  className="focus-version-pill"
                  aria-expanded={versionsOpen}
                  aria-label={`Version history (v${item.versions.length})`}
                  title={`v${item.versions.length} — click to inspect versions`}
                  onClick={() => setVersionsOpen((v) => !v)}
                >
                  v{item.versions.length}
                </button>
                {versionsOpen && (
                  <div className="focus-version-menu" role="menu" aria-label="Versions">
                    {[...item.versions].reverse().map((v, revIdx) => {
                      const vNum = item.versions.length - revIdx;
                      const isCurrent = v.id === item.currentVersionId;
                      return (
                        <button
                          type="button"
                          key={v.id}
                          role="menuitem"
                          className={`focus-version-row${isCurrent ? " current" : ""}`}
                          onClick={() => void promoteVersion(v.id)}
                          disabled={!canEdit && !isCurrent}
                          title={
                            isCurrent
                              ? "Current version"
                              : canEdit
                                ? `Promote v${vNum} to current`
                                : `v${vNum}`
                          }
                        >
                          <span>
                            v{vNum} {isCurrent ? "· current" : ""}
                          </span>
                          <small>{actorNameIn(names, v.createdBy)}</small>
                        </button>
                      );
                    })}
                  </div>
                )}
              </span>
            )}
          </span>
        )}
      </div>

      {item && caps && (caps.view || (caps.edit && canEdit)) && (
        <div className="focus-mode-switch" role="group" aria-label="Focus mode">
          {caps.view && (
            <button
              type="button"
              className="focus-mode-btn"
              aria-current={mode === "view" ? "page" : undefined}
              onClick={() => {
                if (mode !== "view") navigate(itemPath(canvasId, item.id));
              }}
              title="View Focus — present and inspect metadata"
            >
              View
            </button>
          )}
          {caps.edit && canEdit && (
            <button
              type="button"
              className="focus-mode-btn"
              aria-current={mode === "edit" ? "page" : undefined}
              onClick={() => {
                if (mode !== "edit") navigate(workbenchItemPath(canvasId, item.id));
              }}
              title="Edit Focus — open studio and node-anchored chat (E)"
            >
              Edit
            </button>
          )}
        </div>
      )}

      {centerAddon}

      <span className="spacer" />

      <div className="floats fs-cluster focus-header-right">
        {/* The deck turning itself, every so many seconds, looping from the
            last slide to the first. This tab's alone — a viewer's playback,
            like the notes beside it, not something everybody watching gets.
            On narrow viewports these presentation controls fold into a single
            menu so the slide title and core actions keep their room. */}
        {hasDeckControls && !compactDeck && (
          <>
            {autoAdvance && (
              <span className="fullscreen-autoadvance" role="group" aria-label="Auto-advance">
                <button
                  type="button"
                  className={`fullscreen-notes-toggle${autoAdvance.on ? " on" : ""}`}
                  onClick={autoAdvance.onToggle}
                  aria-pressed={autoAdvance.on}
                  title={
                    autoAdvance.on
                      ? "Stop turning the slides by themselves (A)"
                      : `Turn to the next slide every ${autoAdvance.seconds} s, looping from the last to the first (A)`
                  }
                >
                  {autoAdvance.on ? "❚❚ Auto" : "▶ Auto"}
                </button>
                {/* One field, the unit inside its border: a bare "s" after the box
                    read as belonging to the button beside it. */}
                <label className="fullscreen-autoadvance-field">
                  <input
                    className="fullscreen-autoadvance-seconds"
                    type="number"
                    min={2}
                    max={600}
                    step={1}
                    aria-label="Seconds per slide"
                    title="Seconds per slide"
                    defaultValue={autoAdvance.seconds}
                    key={autoAdvance.seconds}
                    onBlur={(e) => {
                      // An emptied field keeps the pace it had, not a surprise one.
                      const typed = e.currentTarget.value.trim();
                      if (typed) autoAdvance.onSeconds(Number(typed));
                      else e.currentTarget.value = String(autoAdvance.seconds);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                  />
                  <span className="fullscreen-autoadvance-unit" aria-hidden="true">s</span>
                </label>
              </span>
            )}
            {onToggleNotes && (
              <button
                type="button"
                className={`fullscreen-notes-toggle${presenterNotes ? " on" : ""}`}
                onClick={onToggleNotes}
                title={
                  presenterNotes
                    ? "Hide the speaker notes (N)"
                    : "Show the speaker notes under the slide (N)"
                }
                aria-pressed={presenterNotes}
              >
                Notes
              </button>
            )}
            {/* How the deck moves between slides — the canvas's choice, so it is
                offered only to somebody who may write, and picking one here is
                the same `project.update` the drawer's "Slide transition" sends.
                Here because this is where a presenter is when they want it. Its
                own dropdown rather than the shared context menu: that menu
                belongs to the canvas and sits under full screen by design
                (`--z-fullscreen`), like the version pill's beside it. */}
            {mode === "view" && onToggleNotes && canEdit && transitionsOn && (
              <span className="focus-version-wrap" ref={transitionWrapRef}>
                <button
                  type="button"
                  className="fullscreen-notes-toggle fullscreen-transition"
                  title={`Slide transition: ${deckTransitionLabel(deckTransition)} — how the deck moves from slide to slide, for everybody watching`}
                  aria-haspopup="menu"
                  aria-expanded={transitionsOpen}
                  onClick={() => setTransitionsOpen((open) => !open)}
                >
                  <span className="focus-transition-prefix">Transition: </span>
                  {deckTransitionLabel(deckTransition)}
                  <span className="focus-caret" aria-hidden="true">▾</span>
                </button>
                {transitionsOpen && (
                  /* A preview beside the list (TransitionPreview): whichever row
                     the pointer or the keyboard is on plays in miniature, with its
                     one-line description, so nobody has to pick a name blind. */
                  <div className="focus-version-menu focus-transition-menu with-preview">
                    <Suspense fallback={<div className="tp-panel" />}>
                      <TransitionPreview transition={previewed ?? deckTransition} />
                    </Suspense>
                    <div
                      className="focus-transition-list"
                      role="menu"
                      aria-label="Slide transition"
                      ref={transitionListRef}
                      onKeyDown={(e) => {
                        const rows = [...(transitionListRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]") ?? [])];
                        const at = rows.indexOf(document.activeElement as HTMLButtonElement);
                        const go = (n: number) => rows[(n + rows.length) % rows.length]?.focus();
                        if (e.key === "ArrowDown") go(at + 1);
                        else if (e.key === "ArrowUp") go(at - 1);
                        else if (e.key === "Home") go(0);
                        else if (e.key === "End") go(rows.length - 1);
                        else if (e.key === "Escape") {
                          setTransitionsOpen(false);
                          transitionWrapRef.current?.querySelector<HTMLButtonElement>(".fullscreen-transition")?.focus();
                        } else return;
                        e.preventDefault();
                      }}
                    >
                      {DECK_TRANSITIONS.map((transition) => (
                        <button
                          key={transition}
                          type="button"
                          role="menuitemradio"
                          aria-checked={transition === deckTransition}
                          aria-description={deckTransitionHint(transition)}
                          className={`focus-version-row${transition === deckTransition ? " current" : ""}`}
                          onMouseEnter={() => setPreviewed(transition)}
                          onFocus={() => setPreviewed(transition)}
                          onClick={() => {
                            setTransitionsOpen(false);
                            void sendEchoed(canvasId, actor, { type: "project.update", patch: deckTransitionPatch(transition) });
                          }}
                        >
                          <span>{deckTransitionLabel(transition)}</span>
                          {isDeckTransition3d(transition) && <small>3D</small>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </span>
            )}
          </>
        )}
        {hasDeckControls && compactDeck && (
          <span className="focus-version-wrap" ref={deckMenuWrapRef}>
            <button
              type="button"
              className={`fullscreen-notes-toggle focus-deck-more${deckControlActive ? " on" : ""}`}
              aria-haspopup="menu"
              aria-expanded={deckMenuOpen}
              aria-label="Presentation controls"
              title="Auto-advance, speaker notes, and slide transitions"
              onClick={() => setDeckMenuOpen((open) => !open)}
            >
              ⋯
            </button>
            {deckMenuOpen && (
              <div className="focus-version-menu focus-deck-menu" role="menu" aria-label="Presentation controls">
                {autoAdvance && (
                  <div className="focus-deck-menu-row">
                    <button
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={autoAdvance.on}
                      className={`focus-version-row focus-deck-menu-grow${autoAdvance.on ? " current" : ""}`}
                      onClick={autoAdvance.onToggle}
                    >
                      <span>{autoAdvance.on ? "❚❚ Auto-advance" : "▶ Auto-advance"}</span>
                      <small>A</small>
                    </button>
                    <label className="fullscreen-autoadvance-field">
                      <input
                        className="fullscreen-autoadvance-seconds"
                        type="number"
                        min={2}
                        max={600}
                        step={1}
                        aria-label="Seconds per slide"
                        title="Seconds per slide"
                        defaultValue={autoAdvance.seconds}
                        key={autoAdvance.seconds}
                        onBlur={(e) => {
                          const typed = e.currentTarget.value.trim();
                          if (typed) autoAdvance.onSeconds(Number(typed));
                          else e.currentTarget.value = String(autoAdvance.seconds);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                      />
                      <span className="fullscreen-autoadvance-unit" aria-hidden="true">s</span>
                    </label>
                  </div>
                )}
                {onToggleNotes && (
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={Boolean(presenterNotes)}
                    className={`focus-version-row${presenterNotes ? " current" : ""}`}
                    onClick={onToggleNotes}
                  >
                    <span>Speaker notes</span>
                    <small>N</small>
                  </button>
                )}
                {mode === "view" && onToggleNotes && canEdit && transitionsOn && (
                  <>
                    <div className="focus-deck-menu-heading">Transition</div>
                    <div className="focus-deck-menu-transitions">
                      {DECK_TRANSITIONS.map((transition) => (
                        <button
                          key={transition}
                          type="button"
                          role="menuitemradio"
                          aria-checked={transition === deckTransition}
                          aria-description={deckTransitionHint(transition)}
                          className={`focus-version-row${transition === deckTransition ? " current" : ""}`}
                          onClick={() => {
                            setDeckMenuOpen(false);
                            void sendEchoed(canvasId, actor, { type: "project.update", patch: deckTransitionPatch(transition) });
                          }}
                        >
                          <span>{deckTransitionLabel(transition)}</span>
                          {isDeckTransition3d(transition) && <small>3D</small>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </span>
        )}
        {item && canEdit && (
          <button
            type="button"
            className={`focus-chat-toggle${mode === "edit" && chatOpen ? " active" : ""}`}
            aria-pressed={mode === "edit" ? chatOpen : false}
            aria-label="Node Chat"
            title={`Node-anchored Chat (${shortcut("J")})`}
            onClick={() => {
              if (mode === "edit") {
                toggleChat();
              } else {
                setChatOpen(true);
                navigate(workbenchItemPath(canvasId, item.id));
              }
            }}
          >
            <span>Chat</span>
            {anchoredMessageCount > 0 && (
              <span className="focus-chat-count">{anchoredMessageCount}</span>
            )}
          </button>
        )}
        {mode === "edit" && (
          <DesignSystemsButton
            canvasId={canvasId}
            actor={actor}
            target={item ? { kind: "item", itemId: item.id } : { kind: "canvas" }}
            compact
          />
        )}
        <ShareButton actor={actor} />
        <CanvasPresence actor={actor} onIdentity={onIdentity} />
      </div>
    </div>
  );
}
