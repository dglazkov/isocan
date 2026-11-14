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

import { lazy, Suspense, useEffect, useState, type ComponentProps } from "react";
import { useUiStore } from "../stores/uiStore.ts";

const Panel = lazy(() => import("./TrashPanel.tsx").then((module) => ({ default: module.TrashPanel })));

/** Load Trash on first inspection, then retain its queued restore while it is closed. */
export function TrashPanel(props: ComponentProps<typeof Panel>) {
  const open = useUiStore((state) => state.trashOpen);
  const [opened, setOpened] = useState(open);
  useEffect(() => { if (open) setOpened(true); }, [open]);
  return open || opened ? <Suspense fallback={null}><Panel {...props} /></Suspense> : null;
}
