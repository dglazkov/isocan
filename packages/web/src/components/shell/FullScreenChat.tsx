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

import "./FullScreenChat.css";
import { useEffect } from "react";
import type { Actor } from "@isocan/core";
import { useCanvasStore } from "../../stores/canvasStore.ts";
import { useUiStore } from "../../stores/uiStore.ts";
import { revealItem } from "../../lib/zoomactions.ts";
import { MainThreadBody } from "../MainThreadPanel.tsx";

/**
 * Pure full-screen Chat mode (OS1 ADR 0214): centers the canvas's real
 * `MainThreadBody` in a 640px reading column with a one-click `← Canvas`
 * return bar. Clicking any `#item` artifact card exits full-screen Chat and
 * reveals that item on the canvas.
 */
export default function FullScreenChat({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const record = useCanvasStore((s) => s.record);
  const sessions = useCanvasStore((s) => s.sessions);
  const close = () => useUiStore.getState().setChatFullScreen(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        useUiStore.getState().setChatFullScreen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const agentCount = sessions.filter((s) => s.actor.id !== actor.id).length;

  return (
    <div className="shell-fs-chat" role="region" aria-label="Full-screen chat">
      <header className="shell-fs-chat-bar">
        <div className="shell-fs-chat-left">
          <button
            type="button"
            className="btn"
            title="Back to canvas (Esc)"
            onClick={close}
          >
            ← Canvas
          </button>
          <span className="shell-fs-chat-title">{record?.title ?? "Untitled"}</span>
        </div>
        <span className="shell-fs-chat-meta">
          {agentCount === 0
            ? "Everyone here · Esc to return"
            : `${agentCount} ${agentCount === 1 ? "collaborator" : "collaborators"} here · Esc to return`}
        </span>
      </header>
      <div className="shell-fs-chat-col">
        <MainThreadBody
          canvasId={canvasId}
          actor={actor}
          docked={false}
          onOpenItem={(itemId) => {
            useUiStore.getState().setChatFullScreen(false);
            revealItem(itemId);
          }}
        />
      </div>
    </div>
  );
}
