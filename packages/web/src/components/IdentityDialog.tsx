import { faceMark } from "@isocan/core";
import { useState } from "react";
import type { Actor, Attestation, AttestOffer } from "@isocan/core";
import { adoptIdentity, enterAs, knownIdentities } from "../lib/identity.ts";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { useActorMarks } from "../lib/marks.ts";
import { canVerifyEmail, resumableIn, sendSignInLink, useAttestOffer } from "../lib/signin.ts";

/**
 * The door. First time through it asks for a name; after that it also offers
 * the names this browser has worn, because coming back as yourself should be
 * one click and should return the SAME actor id — the one your undo stack and
 * your mentions hang off. Both paths are `actor.claim` (#58), so the daemon
 * is the one answering — and a refusal (the name already answers to someone
 * on a canvas) is shown here, not silently overridden.
 *
 * Two lists feed the rows, and they render the same (multi-identity phase 1).
 * `knownIdentities()` is who this browser has been; the offer's `resumable`
 * is who it may be, because another badge that proved the same address holds
 * that actor. To the person both are a name to click and become, and both go
 * through `adoptIdentity`. An actor in both lists renders once.
 *
 * **The door starts the proof** (multi-identity phase 2). A person who is
 * somebody on another machine has, until now, had no gesture that begins on
 * this one: the door asked for a name and the only way to prove an address
 * was an identity menu they could not reach without first becoming somebody
 * else. So beneath the name form the door carries one of these, keyed on the
 * offer and never on message text:
 *
 * - **A**, a quiet line — *Already isocan on another machine? Prove your
 *   address* — when the home can verify an email and this badge has proved
 *   nothing yet. On a home with no attester nothing renders, and the markup is
 *   byte-for-byte the door before this phase.
 * - **B**, the address field, expanded in place of the line. Not a second
 *   dialog: the door is already the top layer.
 * - **C**, the link is sent. The name form stays live above it, because a
 *   person must never be trapped waiting on an inbox to enter a canvas they
 *   could have entered as anybody.
 * - **D**, proved, and `resumable` names somebody: the rows above the name
 *   field are the whole of it, so no line renders.
 * - **D′**, proved, and nobody to pick up: the words say what was proved and
 *   name the gesture on the other machine, because this is the one moment the
 *   person is guaranteed to be looking at the problem.
 *
 * D and D′ are read off the offer, not off the sign-in landing, so they are
 * true whenever the person meets the door and not only on the return leg.
 */
export function IdentityDialog({ onDone }: { onDone: (actor: Actor) => void }) {
  const colors = useActorColors();
  const marks = useActorMarks();
  const [name, setName] = useState("");
  const [known] = useState(knownIdentities);
  const offer = useAttestOffer();
  const people = withResumable(known, resumableIn(offer));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const attempt = (claim: Promise<Actor>) => {
    setBusy(true);
    setError(null);
    claim.then(onDone).catch((err: Error) => {
      setError(err.message);
      setBusy(false);
    });
  };

  return (
    <div className="identity-backdrop">
      <div className="identity-dialog">
        <h2>{people.length > 0 ? "Who's writing?" : "Welcome to isocan"}</h2>
        <p>
          Pick a name — it's stamped on everything you add, move, and say on the
          canvas, here and in the CLI.
        </p>
        {people.length > 0 && (
          <div className="identity-known">
            {people.map((actor) => (
              <button
                key={actor.id}
                className="identity-known-row"
                disabled={busy}
                onClick={() => attempt(adoptIdentity(actor))}
                title={`Come back as ${actor.name}`}
              >
                <span className="face-mark" style={{ background: actorColorIn(colors, actor.id) }}>
                  {faceMark(marks, actor)}
                </span>
                {actor.name}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = name.trim();
            if (trimmed) attempt(enterAs(trimmed));
          }}
        >
          <input
            className="text-input"
            autoFocus
            placeholder={people.length > 0 ? "Or a different name" : "Your name"}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn primary" type="submit" disabled={!name.trim() || busy}>
            Start
          </button>
        </form>
        {error && <div className="identity-warning">{error}</div>}
        {offer && canVerifyEmail(offer) && <Prove offer={offer} onError={setError} />}
      </div>
    </div>
  );
}

/** Known first, then the resumable actors this browser has not worn, by id. */
export function withResumable(known: readonly Actor[], resumable: readonly Actor[]): Actor[] {
  const seen = new Set(known.map((actor) => actor.id));
  return [...known, ...resumable.filter((actor) => !seen.has(actor.id))];
}

/**
 * The part of the door beneath the name form — states A, B, C and D′ above.
 * Only mounted when the home can verify an email; which state it is in is
 * read off the offer first (proved or not) and off local state second (has
 * the person opened the field, has a link gone out).
 */
function Prove({
  offer,
  onError,
}: {
  offer: AttestOffer;
  /** The door's one warning slot; a provider refusal renders where a refused
   * claim does. */
  onError: (message: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const proved = offer.attestations.length > 0;
  // D — the rows say everything; a line under them would be asking a person
  // who is one click from being themselves to prove it again.
  if (proved && offer.resumable.length > 0) return null;
  // D′ — proved, and nobody on this home has proved the same address. Keyed
  // on `resumable` alone: a name this browser once wore may sit in a row
  // above, and these words stay true beside it — that row is not a proved
  // person, it is a name.
  if (proved) {
    const address = provedAddress(offer.attestations);
    return (
      <div className="identity-prove">
        <div className="identity-prove-line">
          <b>{address}</b> is proved on this browser. Nobody else here has proved it, so there is
          nobody to pick up.
        </div>
        <div className="identity-prove-line">
          If you are already somebody on another machine, prove the same address there too —
          identity menu → “Prove your address…” — then come back here.
        </div>
      </div>
    );
  }
  // C — said in full: the next thing that happens is in another application,
  // and the name form above is still the way in meanwhile.
  if (sent) {
    return (
      <div className="identity-prove">
        <div className="identity-prove-line">
          Check <b>{sent}</b>. Open the link in this browser.
        </div>
      </div>
    );
  }
  // A — the quiet line. It asks nothing of the stranger on a share link.
  if (!open) {
    return (
      <div className="identity-prove">
        <div className="identity-prove-line">
          Already isocan on another machine?{" "}
          <button type="button" className="identity-prove-open" onClick={() => setOpen(true)}>
            Prove your address
          </button>
        </div>
      </div>
    );
  }
  // B — the line has become the field.
  const send = async (): Promise<void> => {
    if (!offer.auth || sending) return;
    setSending(true);
    onError(null);
    try {
      await sendSignInLink(email, offer.auth);
      setSent(email.trim());
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="identity-prove">
      <div className="identity-prove-line">
        Already isocan on another machine? Prove the address you proved there, and this browser
        can be you.
      </div>
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
        <button className="btn primary" type="submit" disabled={sending || !email.includes("@")}>
          Send me a link
        </button>
      </form>
    </div>
  );
}

/**
 * The address to name in D′: the most recent attestation, without its
 * namespace prefix. Attributes are `email:<addr>` today and may be
 * `repo:<…>` later; only the prefix this door can ask for is stripped, so a
 * future attester's attribute reads as written rather than mangled.
 */
function provedAddress(attestations: readonly Attestation[]): string {
  const latest = attestations[attestations.length - 1]!;
  return latest.attribute.replace(/^email:/, "");
}
