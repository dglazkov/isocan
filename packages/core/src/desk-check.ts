/**
 * **The desk check** (proactive-agent phase 8, design §9 "Before you share").
 *
 * `isocan share` and `isocan present` (and the Share dialog) run it first:
 * the design audit, contrast, the words against the Voice, wires behind the
 * design system, stale receipts, and any critic set to *before I share*.
 * **It reports; it never blocks** — a share goes ahead whatever it finds, and
 * a blocker a critic raises is a warning, not a gate (chosen, Dion to
 * confirm).
 *
 * This file is the part both surfaces agree on: what was found, said in
 * sections, and the one-line summary. Gathering it is a reader over the
 * canvas's bytes (`@isocan/api/desk-check`), each client supplying its own
 * ports, so the terminal and the dialog cannot say different things.
 */

/** What the desk check found, before it is said. Every list is already short; the words below cap what they show. */
export interface DeskCheckInput {
  /** The screens it read — a share reads every screen; a present, the one item. */
  screens: { itemId: string; title: string }[];
  /** The design audit: values a screen used that its system never named, worst first. Null when no screen could be audited. */
  audit: { audited: number; offSystem: number; worst: { title: string; count: number }[]; unavailable: number } | null;
  /** Contrast the governing systems fail, as `checkDesign` says it. */
  contrast: { system: string; what: string }[];
  /** The words against the Voice: how many findings, and the first few. */
  words: { count: number; first: { title: string; what: string }[]; voice: boolean };
  /** Wires drawn from an older version of their design system. */
  behind: { title: string; system: string }[];
  /** Design receipts whose inputs have changed since they were written. */
  stale: { title: string; why: string }[];
  /** Critics set to *before I share*: asked to read the screens, or waiting and why. */
  critics: { agentName: string; asked: boolean; why?: string }[];
}

/** One section of the check, said. `ok` false is something to look at; never a refusal. */
export interface DeskCheckSection {
  key: "audit" | "contrast" | "words" | "behind" | "stale" | "critics";
  heading: string;
  ok: boolean;
  lines: string[];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** **The check, said**, in the order a reviewer reads it: the system, the eyes, the words, the drift, the evidence, the room. */
export function deskCheckSections(input: DeskCheckInput): DeskCheckSection[] {
  const n = input.screens.length;
  const out: DeskCheckSection[] = [];
  const a = input.audit;
  out.push(
    !a
      ? { key: "audit", heading: "Design audit", ok: true, lines: [n ? "no screen here is governed by a design system to audit against" : "no screens to audit"] }
      : a.offSystem === 0
        ? { key: "audit", heading: "Design audit", ok: true, lines: [`${plural(a.audited, "screen")}, every value from the system${a.unavailable ? ` (${a.unavailable} could not be read)` : ""}`] }
        : { key: "audit", heading: "Design audit", ok: false, lines: [`${plural(a.offSystem, "value")} the system never named`, ...a.worst.slice(0, 3).map((w) => `“${w.title}”: ${plural(w.count, "off-system value")}`)] },
  );
  out.push(input.contrast.length
    ? { key: "contrast", heading: "Contrast", ok: false, lines: input.contrast.slice(0, 3).map((c) => `${c.system}: ${c.what}`) }
    : { key: "contrast", heading: "Contrast", ok: true, lines: ["the design system's ink and accent clear their grounds"] });
  const w = input.words;
  out.push(w.count
    ? { key: "words", heading: "Words", ok: false, lines: [`${plural(w.count, "finding")}${w.voice ? ", held to DESIGN.md's Voice" : ""}`, ...w.first.slice(0, 3).map((f) => `“${f.title}”: ${f.what}`)] }
    : { key: "words", heading: "Words", ok: true, lines: [n ? `nothing to fix${w.voice ? " against DESIGN.md's Voice" : " (no Voice section to hold them to)"}` : "no screens' words to read"] });
  out.push(input.behind.length
    ? { key: "behind", heading: "Wires behind the design system", ok: false, lines: input.behind.slice(0, 4).map((b) => `“${b.title}” was drawn from an older ${b.system}`) }
    : { key: "behind", heading: "Wires behind the design system", ok: true, lines: ["none"] });
  out.push(input.stale.length
    ? { key: "stale", heading: "Stale receipts", ok: false, lines: input.stale.slice(0, 4).map((s) => `“${s.title}”: ${s.why}`) }
    : { key: "stale", heading: "Stale receipts", ok: true, lines: ["none"] });
  out.push(input.critics.length
    ? {
        key: "critics",
        heading: "Critics before you share",
        ok: true,
        lines: input.critics.map((c) => (c.asked ? `${c.agentName} — asked to read ${n === 1 ? "it" : `these ${n} screens`}; its notes land as pins` : `${c.agentName} waits: ${c.why ?? "nothing can wear it here"}`)),
      }
    : { key: "critics", heading: "Critics before you share", ok: true, lines: ["none set to before I share"] });
  return out;
}

/** **The one line above the sections** — how many things to look at, and that it never blocks. */
export function deskCheckSummary(sections: readonly DeskCheckSection[]): string {
  const look = sections.filter((s) => !s.ok).length;
  return `Desk check before you share: ${look ? `${plural(look, "thing")} to look at` : "nothing to look at"} — it reports; it never blocks.`;
}

/**
 * **A walk is offered, never run** (proactive-agent phase 9; chosen, Dion to
 * confirm): walking a flow as someone else is a conversation with the lead,
 * not a check, so the desk check names it as its last line and leaves it to
 * the person.
 */
export const DESK_CHECK_WALK = "Not part of this check: a walk — `isocan walk <flow> --task \"…\"` — walks it as someone else (simulations, never a gate).";

/** The findings as sentences for the critics set to *before I share* to read through their lenses — what is flagged, nothing else. */
export function deskCheckFindings(sections: readonly DeskCheckSection[]): string[] {
  return sections.filter((s) => !s.ok).map((s) => `${s.heading}: ${s.lines.join("; ")}.`);
}
