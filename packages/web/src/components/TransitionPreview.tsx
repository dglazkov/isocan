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

import { useEffect, useRef } from "react";
import {
  deckTransitionHint,
  deckTransitionLabel,
  isDeckTransition3d,
  morphPlan,
  pieceSwapPlan,
  type DeckTransition,
  type MorphPiece,
  type MorphScene,
} from "@isocan/core";
import { DECK_TRANSITION_MS } from "../lib/deckflip.ts";
import "./transition-preview.css";

/**
 * **What a transition looks like, before you pick it.**
 *
 * "How can we quickly show what they may do?" (Dion, 25 Nov 2026). The
 * Transition menu's rows had names and a tooltip; a name like "Poof" says
 * nothing until you have seen it. So the menu shows this beside the list: two
 * miniature slides, flipping forward and back on a loop with whichever motion
 * is under the pointer (or the keyboard), and the one-line description.
 *
 * **It is the real choreography, not a drawing of it.** The world inside is a
 * full 1280×800 slide scaled down, so every pixel distance in a plan means
 * what it means on the stage:
 *
 * - the whole-slide motions wear the same keyframes the deck does
 *   (`presentation.css`, `.deck-moving > .deck-out/.deck-in`);
 * - `poof`, `drift`, `rise` and `morph` are planned by the same core functions
 *   the slide twins play (`pieceSwapPlan`, `morphPlan`), over a scene of
 *   blocks — a title, lines, cards, and a footer that sits in the same place on
 *   both slides, so you can watch the swaps leave it pinned.
 *
 * The two slides share one background on purpose: that is what the content
 * swaps are for, and it makes the difference from Fade or Push legible.
 */

const W = 1280;
const H = 800;
const HOLD_MS = 950;

type Tone = "title" | "line" | "card-a" | "card-b" | "footer";
type Block = Omit<MorphPiece, "i" | "parent"> & { tone: Tone };

const FOOTER: Block = { kind: "text", tag: "footer", text: "footer", x: 90, y: 720, w: 220, h: 22, tone: "footer" };

/** Slide A: a two-line title, a short paragraph, one card. */
const SLIDE_A: Block[] = [
  { kind: "text", tag: "h1", key: "title", text: "a title", x: 90, y: 150, w: 560, h: 66, tone: "title" },
  { kind: "text", tag: "h1", text: "a title, second line", x: 90, y: 236, w: 400, h: 66, tone: "title" },
  { kind: "text", tag: "p", text: "a first line", x: 90, y: 350, w: 500, h: 28, tone: "line" },
  { kind: "text", tag: "p", text: "a second line", x: 90, y: 398, w: 380, h: 28, tone: "line" },
  { kind: "box", tag: "div", cls: "card", x: 740, y: 170, w: 420, h: 340, tone: "card-a" },
  FOOTER,
];

/** Slide B: a one-line title over three cards. */
const SLIDE_B: Block[] = [
  { kind: "text", tag: "h1", key: "title", text: "b title", x: 90, y: 110, w: 880, h: 60, tone: "title" },
  { kind: "box", tag: "div", cls: "card", x: 90, y: 300, w: 330, h: 250, tone: "card-b" },
  { kind: "box", tag: "div", cls: "card", x: 475, y: 300, w: 330, h: 250, tone: "card-b" },
  { kind: "box", tag: "div", cls: "card", x: 860, y: 300, w: 330, h: 250, tone: "card-b" },
  FOOTER,
];

const scene = (blocks: Block[]): MorphScene => ({
  w: W,
  h: H,
  pieces: blocks.map(({ tone: _tone, ...b }, i) => ({ ...b, i, parent: -1 })),
});
const SCENE_A = scene(SLIDE_A);
const SCENE_B = scene(SLIDE_B);

function MiniSlide({ blocks, side, slideRef }: { blocks: Block[]; side: "a" | "b"; slideRef: React.RefObject<HTMLDivElement> }) {
  return (
    <div className="tp-slide" data-side={side} ref={slideRef}>
      <div className="tp-ground" />
      {blocks.map((b, i) => (
        <div key={i} className="tp-piece" data-tone={b.tone} style={{ left: b.x, top: b.y, width: b.w, height: b.h }} />
      ))}
    </div>
  );
}

export default function TransitionPreview({ transition }: { transition: DeckTransition }) {
  const world = useRef<HTMLDivElement>(null);
  const slideA = useRef<HTMLDivElement>(null);
  const slideB = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = world.current;
    const a = slideA.current;
    const b = slideB.current;
    if (!stage || !a || !b) return;
    let alive = true;
    let timer = 0;
    let running: Animation[] = [];
    const sides = { a, b };
    const blocksOf = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>(".tp-piece")];
    const groundOf = (el: HTMLElement) => el.querySelector<HTMLElement>(".tp-ground")!;

    // At rest: one slide shown, on top; the other unseen beneath.
    const rest = (shown: "a" | "b") => {
      running.forEach((anim) => anim.cancel());
      running = [];
      stage.className = "tp-world";
      for (const [name, el] of Object.entries(sides)) {
        el.className = "tp-slide";
        el.style.opacity = name === shown ? "1" : "0";
        el.style.zIndex = name === shown ? "2" : "1";
      }
    };

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rest("a");
    if (still || transition === "cut") {
      // No motion to show: just turn the page now and then.
      let shown: "a" | "b" = "a";
      if (!still) {
        const flip = () => {
          if (!alive) return;
          shown = shown === "a" ? "b" : "a";
          rest(shown);
          timer = window.setTimeout(flip, HOLD_MS + 400);
        };
        timer = window.setTimeout(flip, HOLD_MS);
      }
      return () => {
        alive = false;
        clearTimeout(timer);
      };
    }

    const ms = DECK_TRANSITION_MS[transition];
    const play = (from: "a" | "b") => {
      if (!alive) return;
      const to = from === "a" ? "b" : "a";
      const dir = from === "a" ? "next" : "prev";
      const out = sides[from];
      const into = sides[to];
      out.style.opacity = "1";
      out.style.zIndex = "1";
      into.style.opacity = "1";
      into.style.zIndex = "2";
      const piece = transition === "poof" || transition === "drift" || transition === "rise" || transition === "morph";
      if (piece) {
        const plan =
          transition === "morph"
            ? morphPlan(from === "a" ? SCENE_A : SCENE_B, from === "a" ? SCENE_B : SCENE_A, dir)
            : pieceSwapPlan(transition, from === "a" ? SCENE_A : SCENE_B, from === "a" ? SCENE_B : SCENE_A, dir, ms);
        const apply = (el: HTMLElement, side: typeof plan.out) => {
          const blocks = blocksOf(el);
          running.push(groundOf(el).animate(side.ground.map((f) => ({ ...f })), { duration: ms, fill: "both", easing: "linear" }));
          for (const t of side.tracks) {
            const block = blocks[t.i];
            if (!block) continue;
            running.push(block.animate(t.frames.map((f) => ({ ...f })), { duration: t.duration ?? ms, delay: t.delay ?? 0, fill: "both", easing: t.easing ?? "linear" }));
          }
        };
        apply(out, plan.out);
        apply(into, plan.in);
        if (plan.scene.length) {
          for (const el of [out, into]) running.push(el.animate(plan.scene, { duration: ms, fill: "both", easing: "linear" }));
        }
      } else {
        // The deck's own keyframes, worn exactly as the live frames wear them.
        stage.className = "tp-world deck-moving";
        stage.dataset.flip = dir;
        stage.dataset.transition = transition;
        stage.style.setProperty("--deck-ms", `${ms}ms`);
        out.className = "tp-slide deck-out";
        into.className = "tp-slide deck-in";
      }
      timer = window.setTimeout(() => {
        if (!alive) return;
        rest(to);
        timer = window.setTimeout(() => play(to), HOLD_MS);
      }, ms + 60);
    };
    timer = window.setTimeout(() => play("a"), 420);
    return () => {
      alive = false;
      clearTimeout(timer);
      running.forEach((anim) => anim.cancel());
    };
  }, [transition]);

  return (
    <div className="tp-panel" aria-hidden>
      <div className="tp-stage">
        <div className="tp-world" ref={world}>
          <MiniSlide blocks={SLIDE_A} side="a" slideRef={slideA} />
          <MiniSlide blocks={SLIDE_B} side="b" slideRef={slideB} />
        </div>
      </div>
      <div className="tp-copy">
        <strong>{deckTransitionLabel(transition)}</strong>
        {isDeckTransition3d(transition) && <small>3D</small>}
        <p>{deckTransitionHint(transition)}</p>
      </div>
    </div>
  );
}
