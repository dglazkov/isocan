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

import { useState } from "react";
import type { Actor, CommentThread } from "@isocan/core";
import { goodnightTalk, isSystemActor } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { goodnightLead, planGoodnight } from "../lib/goodnight.ts";
import "./proposal-marks.css";

/**
 * **That's the plan** (proactive-agent phase 2, design §4): under a
 * goodnight conversation the viewer opened, once the lead has answered and
 * until the viewer ends it. The conversation is the Chat itself — the person
 * steers in the composer — and this is the one thing that ends it: the lead
 * writes the note and the promised frames only after it.
 *
 * Mounted by the Chat only once this person has said `/goodnight` there, so
 * nobody else downloads it.
 */
export default function GoodnightPlan({ canvasId, actor, thread }: { canvasId: string; actor: Actor; thread: CommentThread }) {
  const canvas = useCanvasStore((s) => s.canvas);
  const joined = useCanvasStore((s) => s.actorJoins);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  if (!canvas) return null;
  const talk = goodnightTalk(canvas, thread, actor.id, joined);
  if (!talk || talk.planned) return null;
  const answered = talk.after.some((c) => c.author.id !== actor.id && !isSystemActor(c.author.id));
  if (!answered) return null;
  const end = async () => {
    setBusy(true);
    const { lead } = await goodnightLead(canvasId, actor.id);
    const refused = await planGoodnight(canvasId, actor, lead);
    setBusy(false);
    if (refused) setSaid(refused);
  };
  return (
    <div className="goodnight-plan" role="group" aria-label="Your goodnight">
      <p>Steer it here: add, drop, reword, “not that one”. When the list is right, end it, and the note is written from what you agreed.</p>
      <button type="button" className="btn primary" disabled={busy} onClick={() => void end()}>
        That's the plan
      </button>
      {said && <p role="alert">{said}</p>}
    </div>
  );
}
