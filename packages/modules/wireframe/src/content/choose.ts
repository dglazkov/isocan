import { JEV_MODEL, chosenOption, type Answerer, type JevAnswer, type JevRequest, type JevResponse } from "../answerer.ts";
import { GENERIC_PACK, PACKS, PACK_BY_ID } from "./packs.ts";

/**
 * **Jev chooses the pack** (design §10) — one `choice` question over the
 * pack ids, with the request as its state: the kind of question Jev is for.
 * Argmax, with its probability recorded on every screen it fills. Jev runs
 * overconfident (phase 6), so p is a record, not a verdict — but under
 * `PACK_FLOOR` the pick is not trusted at all: the generic pack fills, and
 * the line says so. `--pack <id>` overrides a wrong guess without asking.
 */

export const PACK_FLOOR = 0.4;

export function packRequest(request: string): JevRequest {
  return {
    model: JEV_MODEL,
    state: { request },
    questions: {
      pack: {
        type: "choice",
        instructions: "Which domain does the product in the request belong to? Its screens will be filled with that domain's sample nouns, people, numbers and pictures. Choose generic when no other fits.",
        criteria: Object.fromEntries(PACKS.map((p) => [p.id, `${p.name}: ${p.about}`])),
      },
    },
  };
}

export interface PackChoice {
  /** The pack that fills: the argmax, or generic under the floor. */
  pack: string;
  /** The probability of the argmax. */
  p: number;
  /** What the answerer leaned to — the same as `pack` unless it fell under the floor. */
  leaned: string;
  /** Who chose: the versioned model, `--pack`, or a pack lent by a screen already fleshed. */
  by: string;
  how: "asked" | "flag" | "reused";
  distribution?: Record<string, number>;
  inputTokens?: number;
  ms?: number;
}

export function readPackChoice(request: JevRequest, response: JevResponse, by: string): PackChoice {
  const { value, p, distribution } = chosenOption(request.questions.pack!, response.answers.pack as JevAnswer);
  const known = PACK_BY_ID.has(value) ? value : GENERIC_PACK;
  return { pack: p >= PACK_FLOOR ? known : GENERIC_PACK, p, leaned: known, by, how: "asked", distribution, inputTokens: response.usage?.input_tokens ?? 0 };
}

/** Ask the answerer once for a request's pack. */
export async function choosePack(answerer: Answerer, request: string): Promise<PackChoice> {
  const req = packRequest(request);
  const answered = await answerer.answer(req);
  return { ...readPackChoice(req, answered.response, answered.by), ms: answered.ms };
}

/** `--pack <id>`: checked against the packs, never asked. */
export function flagPack(id: string): PackChoice {
  if (!PACK_BY_ID.has(id)) throw new Error(`no pack "${id}" — the packs are: ${PACKS.map((p) => p.id).join(", ")}`);
  return { pack: id, p: 1, leaned: id, by: "--pack", how: "flag" };
}

/** A choice, for a person: which pack, at what p, and whether the floor sent it to generic. */
export function packLine(c: PackChoice, flowWords: string): string {
  const name = PACK_BY_ID.get(c.pack)?.name ?? c.pack;
  if (c.how === "flag") return `pack: ${c.pack} (${name}) — chosen with --pack · ${flowWords}`;
  if (c.how === "reused") return `pack: ${c.pack} (${name}) — already on these screens, nothing asked · ${flowWords}`;
  const top = Object.entries(c.distribution ?? {}).sort((a, b) => b[1] - a[1]).slice(1, 3).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(", ");
  const under = c.p < PACK_FLOOR ? ` — under ${PACK_FLOOR}, so the generic pack fills${c.leaned !== c.pack ? ` (--pack ${c.leaned} to take the lean)` : ""}` : "";
  return `pack: ${c.leaned} p ${c.p.toFixed(2)}${top ? ` (then ${top})` : ""}${under} · chosen by ${c.by} · ${flowWords}`;
}
