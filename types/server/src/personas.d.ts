import { type Persona } from "../../core/src/index.js";
/**
 * **Personas on disk, with a jail of their own.**
 *
 * They live in `.agents/personas/`, and the tree's jail refuses every name
 * beginning with a dot — correctly, because that rule is what keeps `.env`,
 * `.ssh` and `.git` out of a listing anybody can ask for. Relaxing it to let
 * personas through would open all three, which is not a trade worth making for
 * a feature about markdown files.
 *
 * So this route does not reuse that jail; it has a much tighter one, and tight
 * is the point. **The directory is fixed and the name is a stem, never a
 * path** — no separators, no dots, no traversal to check for, because there is
 * nothing here that could express it. A jail that cannot be walked out of is
 * better than one that catches every way of trying.
 */
export declare const PERSONA_NAME: RegExp;
export interface PersonaOnDisk {
    /** Repo-relative, for display and for `isocan persona show`. */
    file: string;
    persona: Persona;
    /** The file verbatim, so an editor can show what is actually there rather
     *  than a re-rendering of what we parsed out of it. */
    text: string;
}
export declare function readPersonas(root: string): Promise<PersonaOnDisk[]>;
export type PersonaWriteRefusal = "bad-name" | "not-a-persona" | "too-big" | "symlink" | "failed";
/** Front matter or it is not a persona — the same test the reader applies, so
 *  a save cannot produce a file the listing would then ignore. */
export declare const MAX_PERSONA_BYTES: number;
export declare function writePersona(root: string, name: string, text: string): Promise<{
    ok: true;
    file: string;
} | {
    ok: false;
    refusal: PersonaWriteRefusal;
}>;
/** One sentence per refusal, because "no" without which "no" leaves somebody
 *  guessing at their own filesystem. */
export declare function personaRefusal(refusal: PersonaWriteRefusal): string;
