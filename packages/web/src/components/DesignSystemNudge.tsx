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

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Actor } from "@isocan/core";
import { readDesignSystem, type DesignSystemRead } from "@isocan/api/design-system";
import { designSystemIO } from "../lib/design-system.ts";
import { everyWhileVisible } from "../lib/whilevisible.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { DesignSystemsButton } from "./DesignSystemsButton.tsx";

/** A files notice counts genuinely uncovered scopes, using the same permitted inheritance as design reads. */
export function DesignSystemNudge({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const io = useMemo(() => designSystemIO(actor), [actor]), seq = useCanvasStore((state) => state.lastSeq);
  const [read, setRead] = useState<DesignSystemRead | null>(null), [checking, setChecking] = useState(true), [error, setError] = useState(false), [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => everyWhileVisible(refresh, 10_000), [refresh]);
  useEffect(() => {
    const controller = new AbortController(); setChecking(true); setError(false);
    void readDesignSystem(io, { canvasId, signal: controller.signal }).then((value) => { if (!controller.signal.aborted) setRead(value); }).catch(() => { if (!controller.signal.aborted) setError(true); }).finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, [io, canvasId, seq, revision]);
  if (checking) return null;
  if (error || !read?.standing) return <div className="files-design-unavailable"><p>Design coverage could not be checked.</p><button className="btn secondary" onClick={refresh}>Retry design read</button></div>;
  if (read.standing.standing === "fine") return <span hidden data-design-coverage="fine" data-coverage-seq={seq} />;
  return <div className="files-nudge" data-uncovered-screens={read.standing.uncoveredIds.length}><b>{read.standing.uncoveredIds.length} {read.standing.uncoveredIds.length === 1 ? "screen needs" : "screens need"} a reusable design direction</b><p>Capture the controls, spacing and reasoning these screens should carry forward. Each group can have its own system.</p><DesignSystemsButton canvasId={canvasId} actor={actor} target={{ kind: "canvas" }} /></div>;
}
