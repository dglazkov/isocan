import { Suspense, lazy, type ComponentType } from "react";
import type { PageFacts, RendererFacts, UnderlayFacts, WebModule } from "@isocan/core";
import { sandboxModule } from "./core.ts";

/**
 * **The sandbox module's web half: one page, and it reads.**
 *
 * The web cannot run a program and is not going to pretend it can. isocan
 * never runs compute (`docs/architecture.md`), and the shape that WOULD run
 * one in the browser — a frame on the content origin — is still behind the
 * extension-actors gate the 12 Sep check left shut
 * (`docs/projects/modules/phases.md`). So what this surface offers is what it
 * can honestly offer: every program on the canvas, the argv each one runs,
 * how many times it has run, and the line that says where running happens.
 *
 * **The component is lazy and the record is not**, which is the split #156's
 * stickers bug taught: gating the DRAWING and not the download costs every
 * first visit the bytes anyway. The record has to be eager — the context row
 * and the `/run` command are registered at boot — and it is a small object
 * and two short strings. The page is a chunk nobody fetches until they open
 * it.
 */
const Page = lazy(() => import("./page.tsx").then((m) => ({ default: m.SandboxesPage })));

function SandboxesPage(facts: PageFacts) {
  return (
    <Suspense fallback={null}>
      <Page {...facts} />
    </Suspense>
  );
}

export const sandboxWeb: WebModule<
  ComponentType<UnderlayFacts>,
  ComponentType<RendererFacts>,
  never,
  ComponentType<PageFacts>
> = {
  core: sandboxModule,
  pages: [
    {
      segment: "sandboxes",
      label: "Sandboxes",
      hint: "every program on this canvas — each runs where its verb is typed",
      component: SandboxesPage,
    },
  ],
};

export default sandboxWeb;
