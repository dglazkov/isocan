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
 * **It sits in the identity menu**, beside "Your surfaces…" and "Bring your
 * own agent…", for the reason that menu already states: this menu is *how
 * I'm connected here*, and what this browser has proved is another fact about
 * how it is connected. Share is *who may be here*, which is about somebody
 * else — and the Share dialog's "who" field is the other end of this same
 * mechanism, which is exactly why the two are not the same panel.
 *
 * **Two things it does, and the first is the reason a person opens it.**
 * Proving an address here is what lets this person's other machines be them:
 * a browser that proves the same address may RESUME the actor this one holds,
 * because the home vouches for the match (multi-identity phase 4 put this
 * first; the copy used to lead with invitations). And it makes an `email:`
 * grant satisfiable, so a person invited by name can be let in without the
 * link.
 *
 * **The empty case carries instructions.** A badge that proved an address
 * nobody else on this home proved has nobody to pick up, and the panel says
 * so in the door's own D′ words — nobody else here has proved it; prove the
 * same address on the other machine, identity menu → "Prove your address…",
 * then come back — so the message on the second machine and the panel it
 * points to on the first tell one story (journey 3, journey 6's last
 * criterion).
 *
 * The panel is deliberately honest about a home that has borrowed nothing: it
 * says the link is how sharing works here rather than showing a control whose
 * only outcome is a refusal.
 *
 * `VerifyDialog` asks the desk for the offer; `VerifyPanel` draws it. The
 * split exists so the words can be asserted under `renderToStaticMarkup`,
 * where the effect that asks never runs.
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
  const [askError, setAskError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    attesterOffer(true)
      .then((answer) => !cancelled && setOffer(answer))
      .catch((err: Error) => !cancelled && setAskError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <VerifyPanel
      offer={offer}
      askError={askError}
      actor={actor}
      onIdentity={onIdentity}
      onClose={onClose}
    />
  );
}

/**
 * The panel, drawn from the offer it is handed. `offer` is null while the desk
 * is being asked; `askError` is why it could not be, if it could not.
 * `VerifyDialog` is its one caller in the app; the tests are the other.
 */
export function VerifyPanel({
  offer,
  askError,
  actor,
  onIdentity,
  onClose,
}: {
  offer: AttestOffer | null;
  askError: string | null;
  actor: Actor;
  onIdentity: (actor: Actor) => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One warning slot: a refusal from sending or resuming, or the desk that
  // could not be asked. A send needs an offer, so the two never both hold.
  const shown = error ?? askError;

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

      {!offer && !shown && <div className="share-link-note">asking the desk…</div>}

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
            Proving an address here is what lets your other machines be you: a browser that
            proves the same address can become this person instead of a new one. It also lets
            somebody invite <b>you</b> by email instead of handing out the link. isocan has no
            accounts, so this is not a login: proving you read an inbox writes one line onto
            this browser's badge.
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

          {offer.attestations.length > 0 && offer.resumable.length === 0 && (
            // Proved, and nobody to pick up. The door's D′ words, so the
            // message a person read on the other machine and the panel it sent
            // them to say the same thing. The address is the door's rule too:
            // the latest attestation, without the badge's `email:` prefix.
            <div className="share-link-note">
              <b>{offer.attestations[offer.attestations.length - 1]!.attribute.replace(/^email:/, "")}</b>{" "}
              is proved on this browser, and it lets you pick up nobody new here. If you are
              already somebody on another machine, prove the same address there too — identity
              menu → “Prove your address…” — then come back here.
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

      {shown && <div className="identity-warning">{shown}</div>}
    </div>
  );
}

function plural(actors: readonly Actor[]): string {
  const names = actors.map((who) => who.name || who.id);
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]!}`;
}
