import { ApiError } from "../lib/api.ts";

/**
 * A refused claim, as the door and the identity menu show it (multi-identity
 * phase 3).
 *
 * `claims.ts` throws `name-taken` from two places: `admit`, when a claim
 * carries an actor id somebody else holds (a roster row), and `requireFree`,
 * when a fresh claim's name is one somebody else answers to (a typed name).
 * Both messages are written for the CLI — one names `isocan pass`, the other
 * names `--as` and `--new` — and neither means anything in a browser. To the
 * person they are one refusal, so the browser keys on the wire code and
 * renders its own words for it, with the remedy as a control instead of prose.
 * Every other code still shows the server's message.
 */
export type Refusal =
  | { kind: "message"; text: string }
  | { kind: "name-taken"; name: string };

/** Sort a thrown error into what the warning slot shows. `name` is the name
 * the person asked for — typed, or read off the row they clicked. Keyed on
 * `ApiError.code` alone, never on the message text. */
export function refusalFor(err: unknown, name: string): Refusal {
  if (err instanceof ApiError && err.code === "name-taken") return { kind: "name-taken", name };
  return { kind: "message", text: err instanceof Error ? err.message : String(err) };
}

/**
 * The warning slot. For `name-taken`, the copy is the same in the door and in
 * the menu; what differs is where the control leads (the door's address field,
 * or the menu's "Prove your address" panel), so the parent passes that in.
 * With `onProve` null — a home with no attester, or nowhere for the control to
 * go — the sentence ends at the other remedy and no dead control is drawn.
 */
export function RefusalNote({
  refusal,
  onProve,
}: {
  refusal: Refusal;
  onProve: (() => void) | null;
}) {
  if (refusal.kind === "message") return <div className="identity-warning">{refusal.text}</div>;
  return (
    <div className="identity-warning">
      <b>{refusal.name} is somebody else here.</b> Another surface already speaks as them.{" "}
      {onProve ? (
        <>
          If that&apos;s you:{" "}
          <button type="button" className="identity-prove-open" onClick={onProve}>
            Prove your address
          </button>{" "}
          — or pick a different name.
        </>
      ) : (
        "Pick a different name."
      )}
    </div>
  );
}
