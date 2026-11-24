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

import "./PromptPill.css";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import type { Actor } from "@isocan/core";
import { postToMain } from "../../lib/mainthread.ts";
import { chatHiddenNow, openPanel } from "../../lib/panels.ts";
import { loadExperiments, modules } from "../../modules.ts";
import { useCanvasStore } from "../../stores/canvasStore.ts";
import { useUiStore } from "../../stores/uiStore.ts";
import {
  usePromptDockPreference,
  type PromptDock,
} from "./usePanelGeometry.ts";

const ModuleComposerControls = lazy(() =>
  import("../ModuleComposer.tsx").then((m) => ({ default: m.ModuleComposerControls })),
);

/** Fold delay after idle or submit before collapsing to the 270×42 pill (OS1 ADR 0214). */
export const PROMPT_FOLD_DELAY_MS = 3_000;

/** Compact pill dimensions when folded (OS1 ADR 0214). */
export const PROMPT_FOLDED_SIZE = { width: 270, height: 42 } as const;

/** Expanded card width tiers in pixels (OS1 ADR 0214). */
export const PROMPT_EXPANDED_WIDTHS = { compact: 480, wide: 640 } as const;

export interface PromptSelectionChip {
  id: string;
  title: string;
}

export interface PromptPillProps {
  canvasId: string;
  actor: Actor;
  /** Initial folded state (defaults to false so immediate typing works, folds after 3s idle). */
  initialFolded?: boolean;
  /** Override auto-fold delay in ms (defaults to `PROMPT_FOLD_DELAY_MS` = 3000). */
  foldDelayMs?: number;
  /** Optional dock override for isolated tests; otherwise reads/writes localStorage. */
  initialDock?: PromptDock;
  /** Optional selection chip override (defaults to `useUiStore` selection + canvas item titles). */
  selectedItems?: readonly PromptSelectionChip[];
  /** Optional submit override (defaults to `postToMain`). */
  onSubmit?: (payload: { body: string; attachedIds: string[] }) => Promise<unknown> | unknown;
  /** Optional dock change callback. */
  onDockChange?: (dock: PromptDock) => void;
  placeholder?: string;
}

const DOCK_OPTIONS: readonly { value: PromptDock; label: string; title: string }[] = [
  { value: "left", label: "Left", title: "Dock prompt on left" },
  { value: "bottom", label: "Bottom", title: "Dock prompt on bottom" },
  { value: "right", label: "Right", title: "Dock prompt on right" },
];

/**
 * Stitch-styled floating prompt composer (OS1 ADR 0214):
 * - folds to a compact `270×42` pill 3 seconds after idle or submit
 * - expands to `480px` (or `640px` wide) on click or focus
 * - displays active canvas selection chips above the input row
 * - persists `bottom | left | right` dock preference in localStorage
 * - submits directly into the canvas main thread (`postToMain`)
 */
export function PromptPill({
  canvasId,
  actor,
  initialFolded = false,
  foldDelayMs = PROMPT_FOLD_DELAY_MS,
  initialDock,
  selectedItems,
  onSubmit,
  onDockChange,
  placeholder = "Ask the canvas…",
}: PromptPillProps) {
  const formId = useId();
  const [dock, setDock] = usePromptDockPreference(initialDock);
  const [folded, setFolded] = useState(initialFolded);
  const [wide, setWide] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [composerHolder, setComposerHolder] = useState<string | null>(null);
  const [enablingVoice, setEnablingVoice] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const voiceHostRef = useRef<HTMLDivElement>(null);
  const autoStartVoiceRef = useRef(false);
  const foldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedIds = useUiStore((s) => s.selectedItemIds);
  const canvasItems = useCanvasStore((s) => s.canvas?.items);
  // Subscribe to module & experiment changes so `composerOffered` updates live.
  useUiStore((s) => s.modulesGeneration);
  useUiStore((s) => s.experiments);
  const composerOffered = modules()
    .filter((m) => (m.composer ?? []).length > 0)
    .map((m) => m.core.name);
  const voiceActive = composerHolder !== null;

  useEffect(() => {
    if (composerHolder !== null && !composerOffered.includes(composerHolder)) {
      setComposerHolder(null);
    }
  }, [composerHolder, composerOffered]);

  const chips = useMemo<PromptSelectionChip[]>(() => {
    const base =
      selectedItems ??
      selectedIds.map((id) => ({
        id,
        title: canvasItems?.[id]?.title?.trim() || id,
      }));
    if (dismissedIds.length === 0) return [...base];
    const hidden = new Set(dismissedIds);
    return base.filter((chip) => !hidden.has(chip.id));
  }, [selectedItems, selectedIds, canvasItems, dismissedIds]);

  // Reset per-selection dismissals whenever the selection set changes.
  const selectionKey = (selectedItems ? selectedItems.map((c) => c.id) : selectedIds).join(",");
  useEffect(() => {
    setDismissedIds([]);
  }, [selectionKey]);

  const clearFoldTimer = useCallback(() => {
    if (foldTimer.current !== null) {
      clearTimeout(foldTimer.current);
      foldTimer.current = null;
    }
  }, []);

  const scheduleFold = useCallback(() => {
    clearFoldTimer();
    foldTimer.current = setTimeout(() => {
      foldTimer.current = null;
      setFolded(true);
    }, foldDelayMs);
  }, [clearFoldTimer, foldDelayMs]);

  useEffect(() => () => clearFoldTimer(), [clearFoldTimer]);

  // Fold 3 seconds after becoming idle (expanded, unfocused, empty draft, and no live voice).
  useEffect(() => {
    if (folded || voiceActive || enablingVoice) {
      clearFoldTimer();
      return;
    }
    if (!focused && body.trim() === "" && !sending) {
      scheduleFold();
      return;
    }
    clearFoldTimer();
  }, [folded, voiceActive, enablingVoice, focused, body, sending, scheduleFold, clearFoldTimer]);

  const takeComposer = useCallback(
    (moduleName: string, active: boolean) => {
      setComposerHolder(active ? moduleName : null);
      if (active) {
        clearFoldTimer();
        setFolded(false);
      }
    },
    [clearFoldTimer],
  );

  const enableAndStartVoice = useCallback(() => {
    clearFoldTimer();
    setFolded(false);
    setEnablingVoice(true);
    autoStartVoiceRef.current = true;
    useUiStore.getState().setExperiment("modules.talk", true);
    void loadExperiments().finally(() => {
      setEnablingVoice(false);
    });
  }, [clearFoldTimer]);

  // Once the user clicked the lightweight mic to enable `modules.talk`, trigger
  // the real ComposerMic button as soon as its lazy chunk mounts so one click
  // enters Gemini Live directly.
  useEffect(() => {
    if (!autoStartVoiceRef.current || composerOffered.length === 0) return;
    const host = voiceHostRef.current;
    if (!host) return;
    const trigger = () => {
      const mic = host.querySelector<HTMLButtonElement>(".talk-composer-mic");
      if (!mic) return false;
      autoStartVoiceRef.current = false;
      mic.click();
      return true;
    };
    if (trigger()) return;
    const observer = new MutationObserver(() => {
      if (trigger()) observer.disconnect();
    });
    observer.observe(host, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [composerOffered.length]);

  const expand = useCallback(() => {
    clearFoldTimer();
    setFolded(false);
    queueMicrotask(() => inputRef.current?.focus());
  }, [clearFoldTimer]);

  const effectiveSize: "compact" | "wide" =
    wide || body.includes("\n") || body.length > 72 || chips.length >= 3 ? "wide" : "compact";

  const handleDock = useCallback(
    (next: PromptDock) => {
      setDock(next);
      onDockChange?.(next);
    },
    [setDock, onDockChange],
  );

  const submitDraft = useCallback(async () => {
    const trimmed = body.trim();
    if (!trimmed || sending) return;
    const attachedIds = chips.map((c) => c.id);
    setSending(true);
    clearFoldTimer();
    try {
      if (onSubmit) {
        await onSubmit({ body: trimmed, attachedIds });
      } else {
        await postToMain(canvasId, actor, trimmed, attachedIds);
      }
      setBody("");
      setFocused(false);
      inputRef.current?.blur();
      scheduleFold();
    } finally {
      setSending(false);
    }
  }, [body, sending, chips, clearFoldTimer, onSubmit, canvasId, actor, scheduleFold]);

  function handleFormSubmit(e: FormEvent): void {
    e.preventDefault();
    void submitDraft();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submitDraft();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setFocused(false);
      inputRef.current?.blur();
      setFolded(true);
    }
  }

  const isFolded = folded && !voiceActive;
  const typing = !isFolded && !voiceActive && body.trim() !== "";

  return (
    <div className="shell-prompt-wrap" data-dock={dock}>
      <section
        className="shell-prompt-pill"
        aria-label="Prompt composer"
        data-folded={isFolded ? "true" : "false"}
        data-size={isFolded ? "pill" : effectiveSize}
        data-dock={dock}
        data-voice-active={voiceActive ? "true" : "false"}
      >
        {!isFolded && chips.length > 0 && (
          <div className="shell-prompt-chips" aria-label="Selected items">
            {chips.map((chip) => (
              <span key={chip.id} className="shell-prompt-chip" data-chip-id={chip.id}>
                <span className="shell-prompt-chip-label">{chip.title}</span>
                <button
                  type="button"
                  className="shell-prompt-chip-remove"
                  aria-label={`Remove ${chip.title} from prompt`}
                  onClick={() => setDismissedIds((prev) => [...prev, chip.id])}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {!isFolded && !voiceActive && (
          <form id={formId} className="shell-prompt-form" onSubmit={handleFormSubmit}>
            <textarea
              ref={inputRef}
              className="shell-prompt-input"
              aria-label="Prompt message"
              placeholder={placeholder}
              rows={effectiveSize === "wide" ? 2 : 1}
              value={body}
              disabled={sending}
              onFocus={() => {
                clearFoldTimer();
                setFocused(true);
              }}
              onBlur={() => setFocused(false)}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </form>
        )}

        <div className="shell-prompt-row">
          {isFolded && (
            <button
              type="button"
              className="shell-prompt-folded-btn"
              aria-label="Expand prompt composer"
              onClick={expand}
              onFocus={expand}
            >
              <span>{placeholder}</span>
              {chips.length > 0 && (
                <span className="shell-prompt-folded-count">{chips.length} selected</span>
              )}
            </button>
          )}

          {!isFolded && !voiceActive && (
            <div className="shell-prompt-controls" role="group" aria-label="Prompt dock position">
              {DOCK_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className="shell-prompt-dock-btn"
                  title={opt.title}
                  aria-pressed={dock === opt.value}
                  onClick={() => handleDock(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
              <button
                type="button"
                className="shell-prompt-size-btn"
                title={effectiveSize === "wide" ? "Use compact 480px width" : "Expand to 640px width"}
                aria-label={effectiveSize === "wide" ? "Compact width" : "Wide width"}
                onClick={() => setWide((prev) => !prev)}
              >
                {effectiveSize === "wide" ? "480px" : "640px"}
              </button>
              {!chatHiddenNow() && (
                <>
                  <button
                    type="button"
                    className="shell-prompt-size-btn"
                    title="Open Chat panel"
                    aria-label="Open Chat panel"
                    onClick={() => openPanel(canvasId, "main")}
                  >
                    Chat
                  </button>
                  <button
                    type="button"
                    className="shell-prompt-size-btn"
                    title="Full-screen chat"
                    aria-label="Full-screen chat"
                    onClick={() => useUiStore.getState().setChatFullScreen(true)}
                  >
                    ⤢
                  </button>
                </>
              )}
            </div>
          )}

          {/* One stable render site so folding, unfolding, or entering Gemini Live
              never unmounts ModuleComposerControls and drops the session. */}
          <div className="shell-prompt-actions" ref={voiceHostRef}>
            {composerOffered.length > 0 ? (
              <Suspense fallback={null}>
                <ModuleComposerControls
                  canvasId={canvasId}
                  actor={actor}
                  takenOverBy={composerHolder}
                  onTakeOver={takeComposer}
                  hidden={!voiceActive && typing}
                />
              </Suspense>
            ) : (
              <button
                type="button"
                className="shell-prompt-voice-btn"
                title="Talk to the canvas (Gemini Live)"
                aria-label="Talk to the canvas"
                hidden={typing}
                disabled={enablingVoice}
                onClick={enableAndStartVoice}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
                  />
                </svg>
              </button>
            )}

            {!isFolded && !voiceActive && (composerOffered.length === 0 || typing) && (
              <button
                type="submit"
                form={formId}
                className="shell-prompt-send"
                disabled={!body.trim() || sending}
              >
                {sending ? "Sending…" : "Send"}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default PromptPill;
