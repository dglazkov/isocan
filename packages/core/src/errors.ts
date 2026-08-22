export type OpErrorCode =
  | "unknown-item"
  | "unknown-version"
  | "unknown-thread"
  | "unknown-comment"
  | "unknown-anchor"
  | "not-in-trash"
  | "duplicate-id"
  | "empty-body"
  | "last-comment"
  | "main-exists"
  | "name-taken"
  | "unknown-actor"
  /** The speaker named an actor its badge does not claim (the identity desk's
   * mechanism 5). The remedy is always the same and always available: claim
   * the actor first. */
  | "not-your-actor"
  | "internal-op"
  | "unknown-op"
  | "bad-op";

export class OpValidationError extends Error {
  constructor(
    public readonly code: OpErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OpValidationError";
  }
}

/**
 * Exhaustiveness guard for the op switches. `op: never` makes an unhandled
 * variant a compile error; at runtime it rejects an op this build predates —
 * a stale daemon meeting a newer CLI. Without it the switch falls through and
 * returns undefined, which the engine would log as an inverse-less entry and
 * assign as project state.
 */
export function unknownOperation(op: never): never {
  const type = (op as { type?: unknown }).type;
  throw new OpValidationError("unknown-op", `unknown operation: ${String(type)}`);
}
