import { useEffect, useRef, useState } from "react";
import { KEYS_NOT_HERE, KEYS_ROUTE, type KeyProvider, type KeyRow } from "@isocan/core/keys";
import { ApiError, request } from "../lib/api.ts";

/**
 * **"Model keys…"** — the settings area (keys phase 2;
 * `docs/projects/keys/design.md`). `isocan keys`, in the identity menu.
 *
 * Each provider this machine can hold a key for: set or not, the last four,
 * what spends it, and whether the environment overrides it — then Set (or
 * Replace), Remove and Test. The routes are machine-local (`key-routes.ts`):
 * a hosted home answers 404 and this panel says the truth instead.
 *
 * **Write-only, in the page too.** The key goes from a password field into
 * one `PUT` and the field is emptied the moment it is sent. The input is
 * uncontrolled on purpose: a controlled one keeps the value in React state,
 * which outlives the field and is readable from devtools long after. Nothing
 * this panel draws came from the value except the `…abcd` the home computed.
 *
 * Lazy, like every panel this menu opens: the menu is already its own chunk,
 * and this is a second one, so a first visit pays for neither.
 */
export function KeysDialog({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<KeyRow[] | null>(null);
  const [file, setFile] = useState<string | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const [elsewhere, setElsewhere] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<KeyProvider | null>(null);
  /** Which provider's field is open. */
  const [setting, setSetting] = useState<KeyProvider | null>(null);
  /** Which provider's Remove is one click from happening. */
  const [arming, setArming] = useState<KeyProvider | null>(null);
  /** What Test said, per provider. */
  const [tested, setTested] = useState<Partial<Record<KeyProvider, { ok: boolean; said: string }>>>({});
  const field = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const res = await request<{ file: string; refused?: string; keys: KeyRow[] }>("GET", KEYS_ROUTE);
      setRows(res.keys);
      setFile(res.file);
      setRefused(res.refused ?? null);
    } catch (err) {
      if (err instanceof ApiError && err.code === KEYS_NOT_HERE) setElsewhere(true);
      else setError((err as Error).message);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  async function act(provider: KeyProvider, run: () => Promise<unknown>): Promise<void> {
    setBusy(provider);
    setError(null);
    try {
      await run();
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const save = (provider: KeyProvider) => {
    const input = field.current;
    const key = input?.value.trim() ?? "";
    // Emptied before the request is even sent: the value's one trip is the body.
    if (input) input.value = "";
    if (!key) return;
    setTested((was) => ({ ...was, [provider]: undefined }));
    void act(provider, async () => {
      await request("PUT", `${KEYS_ROUTE}/${provider}`, { key });
      setSetting(null);
    });
  };

  const remove = (provider: KeyProvider) => {
    setArming(null);
    setTested((was) => ({ ...was, [provider]: undefined }));
    void act(provider, () => request("DELETE", `${KEYS_ROUTE}/${provider}`));
  };

  const test = (provider: KeyProvider) =>
    void act(provider, async () => {
      const res = await request<{ ok: boolean; answer: string; key: string }>("POST", `${KEYS_ROUTE}/${provider}/test`);
      setTested((was) => ({ ...was, [provider]: { ok: res.ok, said: res.ok ? `accepted (${res.key})` : res.answer } }));
    });

  return (
    <div
      className="terminal-menu keys-menu"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="share-head">Model keys</div>
      {elsewhere ? (
        <div className="share-link-note">
          Your keys live on your machine; this home&rsquo;s keys are set by whoever runs it.
        </div>
      ) : (
        <div className="share-link-note">
          The keys this machine spends — on the judge, the words, and voice. Stored here only, never
          shown again: you see the last four. Also <code>isocan keys</code> in a terminal.
        </div>
      )}
      {error && <div className="identity-warning">{error}</div>}
      {refused && <div className="identity-warning">{refused}</div>}
      {!rows && !error && !elsewhere && <div className="share-link-note">reading this machine&rsquo;s keys…</div>}

      <div className="share-roster">
        {(rows ?? []).map((row) => {
          const said = tested[row.provider];
          return (
            // `share-invited`'s two-line row, reused rather than restyled: the
            // words own the first line, and Set/Test/Remove sit under them —
            // beside the words, three buttons squeezed "used for" to a word a line.
            <div key={row.provider} className="surface-row share-invited keys-row" data-provider={row.provider}>
              <span className="surface-what">
                <b>{row.label}</b>
                <span className="share-roster-kind keys-state">
                  {row.stored ? `set ${row.lastFour}` : "not set"}
                  {row.addedAt ? ` · added ${row.addedAt.slice(0, 10)}` : ""}
                </span>
                <span className="share-roster-kind">used for {row.usedFor.join("; ")}</span>
                {row.env && (
                  <span className="share-roster-kind">
                    set in your environment ({row.env.variable} {row.env.lastFour}) — that one wins
                  </span>
                )}
                {said && (
                  <span className={said.ok ? "share-roster-kind" : "identity-warning"}>
                    {said.ok ? "Test: " : "Test refused: "}
                    {said.said}
                  </span>
                )}
                {setting === row.provider && (
                  <form
                    className="terminal-actions"
                    onSubmit={(e) => {
                      e.preventDefault();
                      save(row.provider);
                    }}
                  >
                    <input
                      ref={field}
                      className="text-input"
                      type="password"
                      autoFocus
                      autoComplete="off"
                      spellCheck={false}
                      aria-label={`${row.label} key`}
                      placeholder="Paste the key"
                      data-1p-ignore
                      data-lpignore="true"
                      data-bwignore="true"
                    />
                    <button className="btn primary" type="submit" disabled={busy !== null}>
                      Save
                    </button>
                    <button className="btn" type="button" onClick={() => setSetting(null)}>
                      Cancel
                    </button>
                  </form>
                )}
              </span>
              {setting !== row.provider && (
                <span className="share-row-controls">
                  <button className="btn" disabled={busy !== null} onClick={() => setSetting(row.provider)}>
                    {row.stored ? "Replace" : "Set"}
                  </button>
                  {(row.stored || row.env) && (
                    <button className="btn" disabled={busy !== null} onClick={() => test(row.provider)}>
                      {busy === row.provider ? "…" : "Test"}
                    </button>
                  )}
                  {row.stored &&
                    (arming === row.provider ? (
                      <button className="btn danger" disabled={busy !== null} onClick={() => remove(row.provider)}>
                        Remove it
                      </button>
                    ) : (
                      <button className="btn" disabled={busy !== null} onClick={() => setArming(row.provider)}>
                        Remove…
                      </button>
                    ))}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {file && <div className="share-link-note">{file}</div>}
    </div>
  );
}
