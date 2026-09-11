import { useUiStore } from "../stores/uiStore.ts";

/**
 * **Things that are on because you turned them on** (9 Sep 2026).
 *
 * > "have a 'Settings' section for experiments and have 'Stickers' as a
 * > boolean that people can turn on and then we can merge all of this"
 *
 * The mechanism that lets unfinished work reach `main` without reaching
 * everybody. A module behind an experiment ships in the bundle, is off, and
 * costs a person who never turns it on nothing but the bytes — which is the
 * trade that makes merging an exploration honest rather than a decision to
 * support it forever.
 *
 * ## It is the same mechanism the API needs, which is why it is worth having
 *
 * VS Code's answer to "move fast without breaking extensions" is two API
 * surfaces: a stable one that is append-only and has essentially never broken
 * since 1.0, and **proposed** APIs that change without notice, must be named
 * in the extension's manifest, only run when the user has explicitly enabled
 * them, and cannot be published to the marketplace at all. Fast on one side,
 * frozen on the other, and the boundary is a list a person opts into.
 *
 * This is that list. A module using a slot we are still shaping — overlays,
 * drops, the host — is an experiment for the same reason a proposed API is:
 * not because it is buggy, but because **we intend to change it**, and
 * somebody should have said yes to that before it is on their screen.
 *
 * ## Per person, not per canvas
 *
 * An experiment is this browser's, like `hiddenChrome` and unlike a theme: it
 * changes what YOU see, not what the canvas IS. A sticker somebody made with
 * the experiment on is an ordinary item with a mime, and it stays on the
 * canvas for everybody — readable by anyone whose build knows the kind, and a
 * file with a legible mime to anyone whose does not. That is #156's removal
 * story, and it is what makes an experiment safe to turn off again.
 */
interface Experiment {
  id: string;
  /** What it is called where a person reads it. */
  name: string;
  /** One sentence: what turning it on gets you, and what is unfinished. */
  what: string;
}

/** Every experiment this build offers, in the order Settings lists them. */
export const EXPERIMENTS: readonly Experiment[] = [
  {
    id: "modules.stickers",
    name: "Stickers",
    what: "A tray of emoji you drag onto the canvas — the first module built on the overlay, drop and host APIs, which are still changing.",
  },
];

/** Is this one on? Read outside React — the module list is not a component. */
export function experimentOn(id: string): boolean {
  return useUiStore.getState().experiments.includes(id);
}

