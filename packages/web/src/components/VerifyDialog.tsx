import { useEffect, useState } from "react";
import type { Actor, AttestOffer } from "@isocan/core";
import { attesterOffer, canVerifyEmail, sendSignInLink } from "../lib/signin.ts";
import { adoptIdentity } from "../lib/identity.ts";

/**
 * **"Prove your address…"** — the browser half of borrowing an attester
 * (identity desk, mechanism 3), and the only door mechanism 6 can be reached
 * through.
 *
 * **This is not a login and the copy says so.** isocan has no accounts, so
 * there is nothing to sign in TO: what a person does here is prove they read
 * an inbox, and what it produces is one row on the badge this browser already
 * carries. The word "sign in" appears nowhere on the panel for that reason —
 * it is the word that would make people look for a password, an account
 * settings page, and a way to delete an account that does not exist.
 *
 * **It sits in the identity menu**, beside "Your surfaces…" and "Work from
 * your terminal…", for the reason that menu already states: this menu is *how
 * I'm connected here*, and what this browser has proved is another fact about
 * how it is connected. Share is *who may be here*, which is about somebody
 * else — and the Share dialog's "who" field is the other end of this same
 * mechanism, which is exactly why the two are not the same panel.
 *
 * **Two things it does, and the second is the phase's Outcome.** Proving an
 * address makes an `email:` grant satisfiable, so a person invited by name can
 * be let in without the link. And it makes this browser eligible to RESUME the
 * person another surface already is — Jordan's phone becoming Jordan, which
 * before this could only be done by asserting it, which is to say by anybody.
 *
 * The panel is deliberately honest about a home that has borrowed nothing: it
 * says the link is how sharing works here rather than showing a control whose
 * only outcome is a refusal.
 */
export function VerifyDialog({
  actor,
  onIdentity,
  onClose,
}: {
  actor: Actor;
  onIdentity: (actor: Actor) => void;
  onClose: () => void;
}) {
  const [offer, setOffer] = useState<AttestOffer | null>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    attesterOffer(true)
      .then((answer) => !cancelled && setOffer(answer))
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  async function send(): Promise<void> {
    if (!offer?.auth || busy) return;
    setBusy(true);
    setError(null);
    try {
      await sendSignInLink(email, offer.auth);
      setSent(email.trim());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resume(who: Actor): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      // The ordinary resume path — `as` plus the name, exactly as switching
      // personas already sends. What is new is not the request, it is that the
      // home will now VOUCH for it: this badge and the badge already holding
      // that actor proved the same address. Nothing here is special-cased,
      // which is the point of the vouch being one rule.
      onIdentity(await adoptIdentity(who));
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="terminal-menu"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="share-head">Prove your address</div>

      {!offer && !error && <div className="share-link-note">asking the desk…</div>}

      {offer && !canVerifyEmail(offer) && (
        <div className="share-link-note">
          This home has borrowed nowhere to verify an address — no inbox, no Google, no GitHub —
          so there is nothing to prove here yet. Sharing works by link, which is how it has
          worked all along.
        </div>
      )}

      {offer && canVerifyEmail(offer) && (
        <>
          <div className="share-link-note">
            isocan has no accounts, so this is not a login: proving you read an inbox writes one
            line onto this browser's badge. It lets somebody invite <b>you</b> by email instead
            of handing out the link — and it lets this browser be a person your other machines
            already are.
          </div>

          {offer.attestations.length > 0 && (
            <div className="share-roster">
              {offer.attestations.map((row) => (
                <div key={row.attribute} className="surface-row">
                  <span className="surface-what">
                    <b>{row.attribute.replace(/^email:/, "")}</b>
                    <span className="share-roster-kind">
                      proved · via {row.verifiedVia} · {row.at.slice(0, 10)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {sent ? (
            // Said in full, because the next thing that happens is in another
            // application: a person who does not know to go and look at their
            // mail will sit here waiting for this panel to change.
            <div className="share-link-note">
              <b>A link is on its way to {sent}.</b> Open it in this browser and you land back
              here, proved. It works once. On a dev home it may well be in your spam folder —
              the sender domain is not isocan's yet.
            </div>
          ) : (
            <form
              className="share-address"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <input
                className="text-input"
                type="email"
                autoFocus
                aria-label="Your email address"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button className="btn primary" type="submit" disabled={busy || !email.includes("@")}>
                Send me a link
              </button>
            </form>
          )}

          {offer.resumable.length > 0 && (
            <>
              <div className="identity-menu-head">You are also</div>
              <div className="share-link-note">
                Another surface that proved the same address answers to {plural(offer.resumable)}.
                Becoming them here is a resume, not a new person: the work already theirs stays
                theirs.
              </div>
              <div className="share-roster">
                {offer.resumable.map((who) => (
                  <div key={who.id} className="surface-row">
                    <span className="surface-what">
                      <b>{who.name || who.id}</b>
                      {who.id === actor.id && <span className="surface-self"> you, here</span>}
                    </span>
                    <button
                      className="btn"
                      disabled={busy || who.id === actor.id}
                      onClick={() => void resume(who)}
                    >
                      Be them
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {error && <div className="identity-warning">{error}</div>}
    </div>
  );
}

function plural(actors: readonly Actor[]): string {
  const names = actors.map((who) => who.name || who.id);
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]!}`;
}
