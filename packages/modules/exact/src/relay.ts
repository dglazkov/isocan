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
 * **A teammate through Exact's relay** (exact phase 8; design §5, §12), the
 * browser half.
 *
 * The machine running `isocan exact live` with a relay has a Tamber wire at
 * an HTTPS name (`https://<id>-tool.<label>.<relay>`), its TLS ending in that
 * machine's dev loop, and prints a one-use code at `read`. A teammate enters
 * the name and the code on a screen; this browser pairs with the wire through
 * the relay and keeps the wire's token for that app. From then on:
 *
 * - **Live** asks the wire for a canvas grant and opens the dev page through
 *   the relay's canvas name. Exact's canvas door is framed by its own tool's
 *   origin only (`frame-ancestors`), so the page opens in its own tab — never
 *   a refreshed picture passed off as a frame.
 * - **A token drag** is sent as Tamber's own `scrub`, and the wire answers a
 *   `read` client 403: the refusal is shown in the wire's words. Nothing in
 *   this file decides a scope; the wire does.
 *
 * The wire answers its own origin only, or — with `--allow-plugin-origin`,
 * which the bridge sets — a sandboxed page (`Origin: null`): so every call goes
 * through one hidden sandboxed frame, which can read nothing of the canvas.
 * Without a pairing a viewer sees captures, and the screen says so.
 */

export const CAPTURED_ONLY = "Captured only, nothing live: this browser has no pairing with the machine running `isocan exact live`.";
export const RELAY_NOTE = "Live through the relay, read only — Exact's canvas door lets only its own tool frame it, so it opens in a tab of its own.";

/** A Tamber code as the bridge prints it for a teammate: the wire's relay name, then `XXXXX-XXXXX`. */
export function parseRelayCode(text: string): { tool: string; code: string } | null {
  const m = /^\s*(https:\/\/[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?)\/?\s+([0-9A-Za-z]{5})-?([0-9A-Za-z]{5})\s*$/.exec(text);
  if (!m || !/^https:\/\/[a-z0-9]+-tool\./.test(m[1]!)) return null;
  return { tool: m[1]!, code: `${m[2]!.toUpperCase()}-${m[3]!.toUpperCase()}` };
}

/** The wire's refusal in its own words: `refused on Tamber's wire (403): scrub needs `write` scope; this client has `read``. */
export function wireRefusal(status: number, text: string): string {
  let message = text.slice(0, 200);
  try {
    const body = JSON.parse(text) as { error?: { message?: string } | string };
    message = typeof body.error === "string" ? body.error : body.error?.message ?? message;
  } catch { /* not JSON: the text as it came */ }
  return `refused on Tamber's wire (${status}): ${message}`;
}

export interface RelayPairing { tool: string; token: string; client: string; scope: string; at: number }

const KEY = (appId: string) => `isocan.exact.relay.${appId}`;

/** This browser's pairing with an app's wire through the relay, or null. */
export function relayPairing(appId: string): RelayPairing | null {
  try {
    const p = JSON.parse(localStorage.getItem(KEY(appId)) ?? "null") as RelayPairing | null;
    return p && typeof p.tool === "string" && typeof p.token === "string" ? p : null;
  } catch {
    return null;
  }
}

export function forgetRelay(appId: string): void {
  try { localStorage.removeItem(KEY(appId)); } catch { /* nothing kept */ }
}

// ---------------------------------------------------------------- the sandboxed client

const CLIENT_DOC = `<!doctype html><script>
onmessage = async (e) => {
  const { id, url, body, token } = e.data || {};
  if (typeof url !== "string" || !/^https:\\/\\/[a-z0-9.-]+\\/__tamber(\\/pair)?$/.test(url)) return parent.postMessage({ id, status: 0, text: "not a wire address" }, "*");
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...(token ? { "x-exact-tamber-token": token } : {}) }, body: JSON.stringify(body), credentials: "omit", referrerPolicy: "no-referrer" });
    parent.postMessage({ id, status: r.status, text: await r.text() }, "*");
  } catch (err) {
    parent.postMessage({ id, status: 0, text: String(err) }, "*");
  }
};
</script>`;

let frame: HTMLIFrameElement | null = null;
let ready: Promise<HTMLIFrameElement> | null = null;
let next = 0;
const waiting = new Map<number, (a: { status: number; text: string }) => void>();

function client(): Promise<HTMLIFrameElement> {
  if (ready) return ready;
  ready = new Promise((resolve) => {
    const f = document.createElement("iframe");
    f.sandbox.add("allow-scripts");
    f.srcdoc = CLIENT_DOC;
    f.title = "Exact relay client";
    f.setAttribute("aria-hidden", "true");
    f.style.cssText = "position:fixed;width:0;height:0;border:0;visibility:hidden";
    window.addEventListener("message", (e) => {
      if (e.source !== f.contentWindow) return;
      const d = e.data as { id?: number; status?: number; text?: string };
      const w = typeof d?.id === "number" ? waiting.get(d.id) : undefined;
      if (w) { waiting.delete(d.id!); w({ status: d.status ?? 0, text: d.text ?? "" }); }
    });
    f.addEventListener("load", () => { frame = f; resolve(f); }, { once: true });
    document.body.append(f);
  });
  return ready;
}

/** One call to the wire through the relay, from the sandboxed client. */
async function wire(tool: string, path: "/__tamber" | "/__tamber/pair", body: unknown, token?: string): Promise<{ status: number; text: string }> {
  const f = await client();
  const id = ++next;
  return new Promise((resolve) => {
    const t = setTimeout(() => { waiting.delete(id); resolve({ status: 0, text: "the relay did not answer in 20 s" }); }, 20_000);
    waiting.set(id, (a) => { clearTimeout(t); resolve(a); });
    (frame ?? f).contentWindow?.postMessage({ id, url: `${tool}${path}`, body, token }, "*");
  });
}

/** Pair with the wire through the relay, by the code its owner's bridge printed; kept for this app in this browser. */
export async function relayPair(appId: string, tool: string, code: string): Promise<RelayPairing> {
  const r = await wire(tool, "/__tamber/pair", { code, name: "teammate" });
  if (r.status !== 200) throw new Error(r.status === 0 ? `the relay could not be reached: ${r.text}` : wireRefusal(r.status, r.text));
  const answer = JSON.parse(r.text) as { ok?: { token: string; client: string; scope: string }; token?: string; client?: string; scope?: string };
  const ok = answer.ok ?? (answer as { token: string; client: string; scope: string });
  const pairing: RelayPairing = { tool, token: ok.token, client: ok.client, scope: ok.scope, at: Date.now() };
  try { localStorage.setItem(KEY(appId), JSON.stringify(pairing)); } catch { /* this tab only */ }
  return pairing;
}

/**
 * Live through the relay: the wire mints a single-use canvas grant, and the
 * dev page opens through the relay's canvas name in a tab of its own (the
 * tab is opened at the press, so no popup rule stops it).
 */
export async function relayOpenLive(appId: string): Promise<string> {
  const p = relayPairing(appId);
  if (!p) throw new Error("not paired with this app's relay");
  const tab = window.open("about:blank", "_blank");
  const r = await wire(p.tool, "/__tamber", { method: "canvas" }, p.token);
  if (r.status === 401) { forgetRelay(appId); tab?.close(); throw new Error("the wire no longer knows this pairing (revoked, expired, or the loop restarted): pair again"); }
  if (r.status !== 200) { tab?.close(); throw new Error(r.status === 0 ? `the relay could not be reached: ${r.text}` : wireRefusal(r.status, r.text)); }
  const grant = (JSON.parse(r.text) as { ok: { url: string; grant: string } }).ok;
  const where = `${grant.url}#g=${grant.grant}`;
  if (tab) { tab.opener = null; tab.location.href = where; } else window.open(where, "_blank", "noopener");
  return new URL(grant.url).host;
}

/** A token drag as Tamber's own scrub through the relay: the wire's answer, in its words. */
export async function relayScrub(appId: string, name: string, value: string): Promise<{ ok: boolean; said: string }> {
  const p = relayPairing(appId);
  if (!p) return { ok: false, said: "not paired with this app's relay" };
  const hello = await wire(p.tool, "/__tamber", { method: "hello" }, p.token);
  if (hello.status !== 200) return { ok: false, said: hello.status === 0 ? `the relay could not be reached: ${hello.text}` : wireRefusal(hello.status, hello.text) };
  const files = (JSON.parse(hello.text) as { ok?: { files?: Record<string, string> } }).ok?.files ?? {};
  const r = await wire(p.tool, "/__tamber", { method: "scrub", client: p.client, files, ops: [{ op: "set-token", name, value }] }, p.token);
  return r.status === 200 ? { ok: true, said: `the wire took the scrub at ${p.scope} scope` } : { ok: false, said: wireRefusal(r.status, r.text) };
}
