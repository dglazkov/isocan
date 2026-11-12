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

import { Suspense, lazy, type ComponentType } from "react";
import type {
  FocusFacts,
  ModuleFocus,
  RendererFacts,
  UnderlayFacts,
  WebModule,
} from "@isocan/core";
import {
  LOTTIE_JSON_MIME,
  LOTTIE_ZIP_MIME,
  isLottieItem,
  lottieModule,
} from "./core.ts";

const LazyLottiePlayer = lazy(() => import("./player.tsx"));
const LazyLottieFocusView = lazy(() =>
  import("./focus.tsx").then((m) => ({ default: m.LottieFocusView })),
);
const LazyLottieFocusEdit = lazy(() =>
  import("./focus.tsx").then((m) => ({ default: m.LottieFocusEdit })),
);

function LottieCardView(facts: RendererFacts) {
  return (
    <Suspense fallback={<div className="file-view">{facts.filename}</div>}>
      <LazyLottiePlayer {...facts} />
    </Suspense>
  );
}

function LottieFocusViewShell(facts: FocusFacts) {
  return (
    <Suspense fallback={<div className="page-note">Loading Lottie studio…</div>}>
      <LazyLottieFocusView {...facts} />
    </Suspense>
  );
}

function LottieFocusEditShell(facts: FocusFacts) {
  return (
    <Suspense fallback={<div className="page-note">Loading Lottie studio…</div>}>
      <LazyLottieFocusEdit {...facts} />
    </Suspense>
  );
}

export const lottieFocusFacet: ModuleFocus<
  ComponentType<FocusFacts>,
  ComponentType<FocusFacts>
> = {
  id: "module.lottie",
  priority: 20,
  matches: isLottieItem,
  view: LottieFocusViewShell,
  edit: LottieFocusEditShell,
  agentPrompts: [
    {
      label: "Sync to DESIGN.md",
      prompt:
        "Remap this Lottie animation's colors to match the governing DESIGN.md palette.",
    },
    {
      label: "Audit compatibility",
      prompt:
        "Lint this Lottie animation for ThorVG, iOS, and Android compatibility and suggest fixes.",
    },
    {
      label: "Trim dead frames",
      prompt:
        "Trim leading or trailing static frames from this Lottie animation.",
    },
  ],
};

export const lottieWeb: WebModule<
  ComponentType<UnderlayFacts>,
  ComponentType<RendererFacts>,
  never,
  never,
  never,
  never,
  never,
  never,
  ComponentType<FocusFacts>
> = {
  core: lottieModule,
  renderers: [{ mimes: [LOTTIE_JSON_MIME, LOTTIE_ZIP_MIME], component: LottieCardView }],
  focus: [lottieFocusFacet],
};

export { LottieFocusEdit, LottieFocusView, layerSubtargetFor } from "./focus.tsx";

export default lottieWeb;
