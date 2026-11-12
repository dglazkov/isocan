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

import { useEffect, useState } from "react";
import { noteFor } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { readBlobText } from "../lib/api.ts";
import { Markdown } from "../lib/markdown.tsx";
/** A readable, scrollable phone sheet; closing it changes no slide or desktop Notes preference. */
export function PresentationNotes({ canvasId, itemId, onClose }: { canvasId: string; itemId: string | null; onClose: () => void }) {
  const note = useCanvasStore((s) => s.canvas && itemId ? noteFor(s.canvas, itemId) : null);
  const version = note?.versions.find((v) => v.id === note.currentVersionId) ?? note?.versions[0];
  const blobHash = version?.blobHash;
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true; setText(null); setFailed(false);
    if (blobHash) void readBlobText(canvasId, blobHash).then((body) => { if (live) setText(body); }, () => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [canvasId, blobHash]);
  return <aside className="presentation-notes-sheet" role="dialog" aria-label="Speaker notes">
    <header><strong>Speaker notes</strong><button onClick={onClose} aria-label="Close speaker notes">Close</button></header>
    <div>{text !== null ? <Markdown>{text}</Markdown> : <p>{failed ? "The notes are unavailable." : note ? "Loading notes…" : "No speaker notes for this item."}</p>}</div>
  </aside>;
}
