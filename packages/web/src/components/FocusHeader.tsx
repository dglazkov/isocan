import "./focus.css";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
}: FocusHeaderProps) {
  const navigate = useNavigate();
  const canEdit = useCanEdit();
  const threads = useCanvasStore((s) => s.canvas?.threads);
  const deckTransition = useCanvasStore((s) => deckTransitionOf(s.record ?? {}));
  const names = useActorNames();
  const chatOpen = useFocusStore((s) => s.chatOpen);
  const toggleChat = useFocusStore((s) => s.toggleChat);
  const setChatOpen = useFocusStore((s) => s.setChatOpen);

  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState(item?.title ?? "");
  const [versionsOpen, setVersionsOpen] = useState(false);
  const versionWrapRef = useRef<HTMLSpanElement>(null);
  const [transitionsOpen, setTransitionsOpen] = useState(false);
  const transitionWrapRef = useRef<HTMLSpanElement>(null);

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

  return (
    <div className={barClass}>
      <div className="floats fs-cluster">
        <button className="fullscreen-back" onClick={onBack} title="Back to the canvas (Esc)">
          ← Canvas
        </button>
        <CanvasTitle actor={actor} />
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
                title="Click to rename item"
                onClick={() => {
                  setTitleDraft(item.title);
                  setRenaming(true);
                }}
              >
                <b>{item.title}</b>
              </button>
            ) : (
              <b>{item.title}</b>
            )}
            {mode === "view" && currentVersion?.filename && <i>{currentVersion.filename}</i>}
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

      <div className="floats fs-cluster">
        {mode === "view" && onToggleNotes && (
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
        {mode === "view" && onToggleNotes && canEdit && (
          <span className="focus-version-wrap" ref={transitionWrapRef}>
            <button
              type="button"
              className="fullscreen-notes-toggle fullscreen-transition"
              title="How the deck moves from slide to slide, for everybody watching"
              aria-haspopup="menu"
              aria-expanded={transitionsOpen}
              onClick={() => setTransitionsOpen((open) => !open)}
            >
              Transition: {deckTransitionLabel(deckTransition)}
            </button>
            {transitionsOpen && (
              <div className="focus-version-menu focus-transition-menu" role="menu" aria-label="Slide transition">
                {DECK_TRANSITIONS.map((transition) => (
                  <button
                    key={transition}
                    type="button"
                    role="menuitemradio"
                    aria-checked={transition === deckTransition}
                    className={`focus-version-row${transition === deckTransition ? " current" : ""}`}
                    title={deckTransitionHint(transition)}
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
