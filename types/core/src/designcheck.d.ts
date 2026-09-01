import { type DesignDoc } from "./designmd.js";
/**
 * Is this design system usable, or just written down?
 *
 * A style guide fails quietly: a colour that no longer parses, a reference to
 * a token somebody renamed, an accent that cannot carry text on its own
 * ground. None of it announces itself — the screens simply drift, and by then
 * the guide is the thing nobody trusts.
 *
 * So the checks are the ones a machine can be right about: shapes, references,
 * and arithmetic. Whether a palette is any GOOD is not in here and should not
 * be; that is what the prose and a person are for.
 */
export type DesignSeverity = "error" | "warning" | "note";
export interface DesignFinding {
    severity: DesignSeverity;
    /** Where it is: a token path, a section name, or "front matter". */
    where: string;
    what: string;
    /** What to do, when there is a single obvious answer. */
    fix?: string;
}
export declare function checkDesign(doc: DesignDoc): DesignFinding[];
/** Worst first, so a report leads with what matters. */
export declare function bySeverity(findings: DesignFinding[]): DesignFinding[];
