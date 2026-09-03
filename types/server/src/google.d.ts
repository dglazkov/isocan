/**
 * **A Drive token on the machine, and the two fetches that use it**
 * (`docs/research/2026-09-02-google-docs-on-the-canvas.md`, stage 3).
 *
 * The research note's rule, kept exactly: credentials live on the machine
 * that runs the agent, never on the canvas. The token is one file under the
 * home, mode 600, written by `isocan gdoc auth` and read by the CLI's
 * `gdoc add`/`sync` and by the daemon's `/api/docs/export` on the same
 * machine — so the app can read a private doc through a daemon that has
 * the token, and a hosted home that has none refuses in words that say
 * where to go.
 *
 * **An access token, not an OAuth dance.** Google access tokens live about
 * an hour, and `gcloud auth print-access-token` (or any OAuth playground)
 * hands one over for a signed-in person with the Drive read-only scope. A
 * refresh flow with a client id and secret of isocan's own is the shape a
 * product would ship; it is also a registered Google application, a
 * consent screen and a review, none of which this stage needs to prove
 * that private docs work. The file records when the token was saved so a
 * refusal can say "that token is a day old" rather than "forbidden".
 */
export declare const googleTokenFile: (home: string) => string;
export interface GoogleToken {
    token: string;
    savedAt: string;
    /** Who it speaks for, when `gdoc auth` could ask Drive. */
    account?: string;
}
export declare function readGoogleToken(home: string): Promise<GoogleToken | null>;
export declare function writeGoogleToken(home: string, token: string, account?: string): Promise<GoogleToken>;
export declare function clearGoogleToken(home: string): Promise<boolean>;
export interface FetchedDoc {
    markdown: string;
    source: string;
    title: string;
    fetchedAt: string;
    /** Which door it came through — a reader deserves to know a private doc
     * was read with a credential. */
    via: "anonymous" | "drive";
}
export declare class DocRefusal extends Error {
    readonly code: "doc-not-public" | "token-refused" | "doc-unreachable";
    constructor(message: string, code: "doc-not-public" | "token-refused" | "doc-unreachable");
}
/**
 * The markdown, through whichever door opens: the anonymous export first
 * (a doc shared by link needs no credential and should not spend one), then
 * Drive with the token. A sign-in page is a refusal, not a document.
 */
export declare function fetchGoogleDoc(id: string, token: GoogleToken | null): Promise<FetchedDoc>;
/** When Drive last saw the doc change — the one call a sync makes before
 *  deciding whether to read it again. Null when there is no token. */
export declare function driveModifiedTime(id: string, token: GoogleToken | null): Promise<string | null>;
/** Whose Drive the token opens — proof it works, for `gdoc auth`. */
export declare function driveAccount(token: string): Promise<string | null>;
