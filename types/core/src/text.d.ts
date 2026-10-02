/**
 * **The home's text route** — `POST /api/text`, the one door through which a
 * canvas asks a text model for schema-shaped words without the key ever
 * leaving the home (copy-edit phase 0.5; `docs/projects/copy-edit/phases.md`).
 *
 * The judgment route's twin (`judgment.ts`), for the other half of the
 * wireframe module's seams: `TextGenerator` (`jev.ts`) writes the words `/wire
 * copy`, `/wire name` and a content `/wire edit` put on a screen. A caller
 * posts one prompt and the JSON Schema its answer must satisfy, with the
 * canvas it is asking for; the home checks the badge may edit that canvas,
 * asks its own text model with its own key, and returns the value and the
 * model that wrote it. The route carries no prompt of its own — the module
 * composes the prompt, as it does on the CLI, so the web and a terminal ask
 * the same question.
 *
 * Both halves read this file: the server's route and every client that calls
 * it, so the path and the refusal codes are spelled once. A subpath
 * (`@isocan/core/text`), never the barrel; the client's side of it,
 * `homeTextGenerator`, is in `jev.ts` with the other generators.
 */
import type { JsonSchema } from "./jev.js";
export { TEXT_UNAVAILABLE } from "./jev.js";
/**
 * The route's path. Here, in a subpath of its own rather than beside
 * `JUDGMENT_ROUTE` in modules.ts, on purpose: modules.ts and the barrel's
 * constants are shared with the web's entry chunk, so a constant there is
 * bytes every first visit downloads (the entry had 15 bytes of headroom on
 * 2 Oct 2026), and a file two lazy chunks share becomes a chunk the entry
 * must name. Only the lazy dialog chunk reads this file in the browser.
 */
export declare const TEXT_ROUTE = "/api/text";
/** A request bigger than this is refused before anything is asked. A screen's copy prompt and schema are a few KB. */
export declare const TEXT_MAX_BYTES: number;
/**
 * How many text completions one badge may ask for per minute. `/wire copy`
 * is one call per screen (~10 for a flow) and `/wire name` one per flow, so
 * thirty lets a person copy, re-copy and rename a flow inside a minute — and
 * keeps a page from turning the home's key into anybody's. Half the judge's
 * sixty because a completion costs far more than a judgment.
 */
export declare const TEXT_PER_MINUTE = 30;
/** The request is over `TEXT_MAX_BYTES`. */
export declare const TEXT_TOO_LARGE = "text-too-large";
/** This badge has asked `TEXT_PER_MINUTE` times in the last minute. */
export declare const TEXT_RATE_LIMITED = "text-rate-limited";
/** The body is not a text request. */
export declare const TEXT_BAD_REQUEST = "text-bad-request";
/** The text model refused or could not be reached; `error` says which, in its words. */
export declare const TEXT_UPSTREAM = "text-upstream";
/** What the route takes: a prompt, the schema its answer must satisfy, and the canvas it is for. */
export interface TextRequest {
    canvasId: string;
    prompt: string;
    schema: JsonSchema;
}
/** What the route answers: the schema-shaped value, and the model that wrote it (`by`, in the module's words). */
export interface TextResponse {
    model: string;
    value: unknown;
}
