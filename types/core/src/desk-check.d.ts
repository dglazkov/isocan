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
    screens: {
        itemId: string;
        title: string;
    }[];
    /** The design audit: values a screen used that its system never named, worst first. Null when no screen could be audited. */
    audit: {
        audited: number;
        offSystem: number;
        worst: {
            title: string;
            count: number;
        }[];
        unavailable: number;
    } | null;
    /** Contrast the governing systems fail, as `checkDesign` says it. */
    contrast: {
        system: string;
        what: string;
    }[];
    /** The words against the Voice: how many findings, and the first few. */
    words: {
        count: number;
        first: {
            title: string;
            what: string;
        }[];
        voice: boolean;
    };
    /** Wires drawn from an older version of their design system. */
    behind: {
        title: string;
        system: string;
    }[];
    /** Design receipts whose inputs have changed since they were written. */
    stale: {
        title: string;
        why: string;
    }[];
    /** Critics set to *before I share*: asked to read the screens, or waiting and why. */
    critics: {
        agentName: string;
        asked: boolean;
        why?: string;
    }[];
}
/** One section of the check, said. `ok` false is something to look at; never a refusal. */
export interface DeskCheckSection {
    key: "audit" | "contrast" | "words" | "behind" | "stale" | "critics";
    heading: string;
    ok: boolean;
    lines: string[];
}
/** **The check, said**, in the order a reviewer reads it: the system, the eyes, the words, the drift, the evidence, the room. */
export declare function deskCheckSections(input: DeskCheckInput): DeskCheckSection[];
/** **The one line above the sections** — how many things to look at, and that it never blocks. */
export declare function deskCheckSummary(sections: readonly DeskCheckSection[]): string;
/**
 * **A walk is offered, never run** (proactive-agent phase 9; chosen, Dion to
 * confirm): walking a flow as someone else is a conversation with the lead,
 * not a check, so the desk check names it as its last line and leaves it to
 * the person.
 */
export declare const DESK_CHECK_WALK = "Not part of this check: a walk \u2014 `isocan walk <flow> --task \"\u2026\"` \u2014 walks it as someone else (simulations, never a gate).";
/** The findings as sentences for the critics set to *before I share* to read through their lenses — what is flagged, nothing else. */
export declare function deskCheckFindings(sections: readonly DeskCheckSection[]): string[];
