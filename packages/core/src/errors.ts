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
  | "internal-op"
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
