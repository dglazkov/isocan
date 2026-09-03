import { promises as fs } from "node:fs";
import path from "node:path";
import {
  docTitleFrom,
  googleDocExportUrl,
  googleDocUrl,
  googleDriveExportUrl,
  googleDriveMetaUrl,
  GOOGLE_DRIVE_ABOUT_URL,
} from "@isocan/core";

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
export const googleTokenFile = (home: string) => path.join(home, "google.json");

export interface GoogleToken {
  token: string;
  savedAt: string;
  /** Who it speaks for, when `gdoc auth` could ask Drive. */
  account?: string;
}

export async function readGoogleToken(home: string): Promise<GoogleToken | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(googleTokenFile(home), "utf8")) as Partial<GoogleToken>;
    return typeof parsed.token === "string" && parsed.token.trim() ? { ...parsed, token: parsed.token.trim(), savedAt: parsed.savedAt ?? "" } : null;
  } catch {
    return null;
  }
}

export async function writeGoogleToken(home: string, token: string, account?: string): Promise<GoogleToken> {
  const record: GoogleToken = { token: token.trim(), savedAt: new Date().toISOString(), ...(account ? { account } : {}) };
  await fs.mkdir(home, { recursive: true });
  await fs.writeFile(googleTokenFile(home), JSON.stringify(record, null, 2) + "\n", { mode: 0o600 });
  await fs.chmod(googleTokenFile(home), 0o600).catch(() => {});
  return record;
}

export async function clearGoogleToken(home: string): Promise<boolean> {
  try {
    await fs.unlink(googleTokenFile(home));
    return true;
  } catch {
    return false;
  }
}

export interface FetchedDoc {
  markdown: string;
  source: string;
  title: string;
  fetchedAt: string;
  /** Which door it came through — a reader deserves to know a private doc
   * was read with a credential. */
  via: "anonymous" | "drive";
}

export class DocRefusal extends Error {
  constructor(
    message: string,
    readonly code: "doc-not-public" | "token-refused" | "doc-unreachable",
  ) {
    super(message);
  }
}

const TIMEOUT = 20_000;

/**
 * The markdown, through whichever door opens: the anonymous export first
 * (a doc shared by link needs no credential and should not spend one), then
 * Drive with the token. A sign-in page is a refusal, not a document.
 */
export async function fetchGoogleDoc(id: string, token: GoogleToken | null): Promise<FetchedDoc> {
  const fetchedAt = new Date().toISOString();
  const source = googleDocUrl(id);
  let anonymous: Response;
  try {
    anonymous = await fetch(googleDocExportUrl(id), { redirect: "follow", signal: AbortSignal.timeout(TIMEOUT) });
  } catch (err) {
    throw new DocRefusal(`could not reach Google: ${(err as Error).message}`, "doc-unreachable");
  }
  const type = anonymous.headers.get("content-type") ?? "";
  if (anonymous.ok && !/text\/html/i.test(type)) {
    const markdown = await anonymous.text();
    return { markdown, source, title: docTitleFrom(markdown, id), fetchedAt, via: "anonymous" };
  }
  if (!token) {
    throw new DocRefusal(
      "Google would not hand this document over anonymously — share it by link (Anyone with the link), or save a Drive token on this machine with `isocan gdoc auth`",
      "doc-not-public",
    );
  }
  let res: Response;
  try {
    res = await fetch(googleDriveExportUrl(id), { headers: { Authorization: `Bearer ${token.token}` }, signal: AbortSignal.timeout(TIMEOUT) });
  } catch (err) {
    throw new DocRefusal(`could not reach Drive: ${(err as Error).message}`, "doc-unreachable");
  }
  if (res.status === 401 || res.status === 403) {
    throw new DocRefusal(tokenRefusedSentence(token, res.status), "token-refused");
  }
  if (!res.ok) throw new DocRefusal(`Drive answered ${res.status} for this document`, "doc-unreachable");
  const markdown = await res.text();
  return { markdown, source, title: docTitleFrom(markdown, id), fetchedAt, via: "drive" };
}

/** When Drive last saw the doc change — the one call a sync makes before
 *  deciding whether to read it again. Null when there is no token. */
export async function driveModifiedTime(id: string, token: GoogleToken | null): Promise<string | null> {
  if (!token) return null;
  const res = await fetch(googleDriveMetaUrl(id), { headers: { Authorization: `Bearer ${token.token}` }, signal: AbortSignal.timeout(TIMEOUT) });
  if (res.status === 401 || res.status === 403) throw new DocRefusal(tokenRefusedSentence(token, res.status), "token-refused");
  if (!res.ok) return null;
  const body = (await res.json()) as { modifiedTime?: string };
  return body.modifiedTime ?? null;
}

/** Whose Drive the token opens — proof it works, for `gdoc auth`. */
export async function driveAccount(token: string): Promise<string | null> {
  const res = await fetch(GOOGLE_DRIVE_ABOUT_URL, { headers: { Authorization: `Bearer ${token.trim()}` }, signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) return null;
  const body = (await res.json()) as { user?: { emailAddress?: string; displayName?: string } };
  return body.user?.emailAddress ?? body.user?.displayName ?? null;
}

function tokenRefusedSentence(token: GoogleToken, status: number): string {
  const age = token.savedAt ? Math.round((Date.now() - Date.parse(token.savedAt)) / 60_000) : null;
  const old = age !== null && age > 55 ? ` — it was saved ${age} minutes ago, and Google's access tokens last about an hour` : "";
  return `Drive refused the token (${status})${old}. Save a fresh one: \`gcloud auth print-access-token | isocan gdoc auth --stdin\`, or check the account can open this document`;
}
