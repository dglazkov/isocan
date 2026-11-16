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

/**
 * **Persona runs** (exact phase 9; journey Scene 9), the facts both surfaces
 * share. A persona — an agent with a goal — finds its way through the live
 * app with Exact's own driver, then records its path: `isocan exact persona`
 * replays it in one cold driver session, a frame before and after each step,
 * and posts the filmstrip with the persona's own verdict and note. The
 * summary card lists every run of the app and where they agreed.
 */

export interface PersonaStep { op: string; ok: boolean; said: string | null; frame: string | null }

/** `exact.persona` on a run's filmstrip (an image whose versions are its frames). */
export interface PersonaRun {
  name: string; goal: string; verdict: "reached" | "stuck"; note: string; by: string;
  host: string; url: string; first: string | null; steps: PersonaStep[];
  /** Where the replay itself broke (a step the driver could not do), or null. */
  broke: number | null;
  at: string;
}

export function parsePersonaRun(text: string | undefined): PersonaRun | null {
  if (!text) return null;
  try { const v = JSON.parse(text) as PersonaRun; return v && typeof v.name === "string" && Array.isArray(v.steps) && (v.verdict === "reached" || v.verdict === "stuck") ? v : null; } catch { return null; }
}

/** The summary card's Markdown: each run's verdict and note, and the steps every run took (where they agreed). */
export function personaSummary(app: string, runs: readonly PersonaRun[]): string {
  const shared = runs.length > 1 ? runs[0]!.steps.map((s) => s.op).filter((op) => runs.every((r) => r.steps.some((s) => s.op === op))) : [];
  const stuck = runs.filter((r) => r.verdict === "stuck");
  return [
    `# Personas on ${app}`,
    "",
    `${runs.length} run${runs.length === 1 ? "" : "s"}: ${runs.filter((r) => r.verdict === "reached").length} reached the goal, ${stuck.length} got stuck. Each filmstrip is the persona's own path, replayed on Exact's driver; each note is the persona's own words.`,
    "",
    "| Persona | Goal | Verdict | Steps | Note |",
    "| --- | --- | --- | --- | --- |",
    ...runs.map((r) => `| ${r.name} | ${r.goal.replace(/\|/g, "/")} | ${r.verdict}${r.broke !== null ? ` (the driver could not do step ${r.broke + 1}: \`${r.steps[r.broke]!.op}\`)` : ""} | ${r.steps.length} | ${r.note.replace(/\|/g, "/").replace(/\n/g, " ")} |`),
    "",
    shared.length ? `Where they agreed: every persona took ${shared.map((s) => `\`${s}\``).join(", ")}.` : "Where they agreed: no step was common to every run.",
    ...(stuck.length ? ["", `Where they got stuck: ${stuck.map((r) => `${r.name} — ${r.note.replace(/\n/g, " ").replace(/[.\s]+$/, "")}`).join("; ")}.`] : []),
    "",
  ].join("\n");
}
