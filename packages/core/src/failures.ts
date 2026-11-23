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
 * **Plain-language failures** (Open Stitch Phase 2A, OS1 ADR 0017).
 *
 * One pure function turns any typed or untyped failure — precondition conflict,
 * provider rate limit, auth error, timeout, validation refusal — into the same
 * `{ headline, why, next, actions, retryable }` shape for CLI stderr, job
 * cards, and the context graph so people and agents talk about a failure in
 * the same words. Raw API keys and bearer tokens are always scrubbed.
 */

/** One concrete recovery action offered beside a failure. */
interface FailureAction {
  /** Machine-readable identifier (`retry`, `reread`, `keys`, `switch-model`). */
  id: string;
  /** Short human label for a button or bullet. */
  label: string;
  /** Optional CLI command that performs the recovery action. */
  command?: string;
}

/** Input fields accepted by {@link describeFailure}. */
interface FailureInput {
  /** Semantic failure category (e.g. `precondition-conflict`, `rate-limit`, `auth`, `timeout`). */
  kind?: string | undefined;
  /** Wire or domain error code (e.g. `edit-conflict`, `unknown-item`, `429`). */
  code?: string | undefined;
  /** HTTP status code, when the failure came over HTTP. */
  status?: number | undefined;
  /** Raw error message; always scrubbed of secrets before surfacing. */
  message?: string | undefined;
  /** Optional model identifier for generation/provider errors. */
  model?: string | undefined;
  /** Optional provider name (e.g. `gemini`, `openai`, `anthropic`). */
  provider?: string | undefined;
}

/** Shared plain-language failure object rendered by CLI, jobs, and context graph. */
export interface PlainFailure {
  /** Short title naming what failed (e.g. `Edit conflict`, `Gemini rate limit`). */
  headline: string;
  /** Plain-English explanation of why it failed, free of raw secrets. */
  why: string;
  /** Concrete next step a person or agent should take. */
  next: string;
  /** Actionable recovery options. */
  actions: FailureAction[];
  /** Whether retrying the same or refreshed request is reasonable. */
  retryable: boolean;
}

const SECRET_PATTERNS: ReadonlyArray<RegExp> = [
  // Provider key prefixes (Anthropic, OpenAI, Google API keys, GitHub/Slack/etc.)
  /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{12,}\b/g,
  /\bAIza[0-9A-Za-z_-]{16,}\b/g,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{16,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{12,}\b/g,
  // Bearer / authorization tokens
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi,
  // Query or key=value secret assignments
  /(\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|secret|password|token)\s*[:=]\s*["']?)[^\s"'&,;}{]+/gi,
];

/** Scrub raw API keys, bearer tokens, and credential query values from text. */
export function scrubSecrets(text: string): string {
  let clean = text;
  clean = clean.replace(SECRET_PATTERNS[0]!, "[redacted]");
  clean = clean.replace(SECRET_PATTERNS[1]!, "[redacted]");
  clean = clean.replace(SECRET_PATTERNS[2]!, "[redacted]");
  clean = clean.replace(SECRET_PATTERNS[3]!, "[redacted]");
  clean = clean.replace(SECRET_PATTERNS[4]!, "Bearer [redacted]");
  clean = clean.replace(SECRET_PATTERNS[5]!, "$1[redacted]");
  return clean.trim();
}

function subjectLabel(input: FailureInput): string {
  const parts = [input.provider, input.model].filter((part): part is string => Boolean(part?.trim()));
  return parts.length > 0 ? parts.join(" / ") : "Request";
}

function cleanedMessage(raw: string | undefined): string {
  if (!raw) return "";
  const scrubbed = scrubSecrets(raw).replace(/\s+/g, " ").trim();
  return scrubbed.length > 240 ? `${scrubbed.slice(0, 237)}…` : scrubbed;
}

/**
 * Translate a typed or untyped failure into one plain-language object shared
 * across CLI stderr, job error metadata, and the context graph.
 */
export function describeFailure(input: FailureInput): PlainFailure {
  const kind = (input.kind ?? "").trim().toLowerCase();
  const code = (input.code ?? "").trim().toLowerCase();
  const status = input.status;
  const detail = cleanedMessage(input.message);
  const subject = subjectLabel(input);

  // 1. Precondition / concurrent edit conflict
  if (
    kind === "precondition-conflict" ||
    kind === "conflict" ||
    code === "precondition-conflict" ||
    code === "edit-conflict" ||
    code === "writer-fenced" ||
    status === 409
  ) {
    return {
      headline: "Edit conflict",
      why: detail || "The item changed after you last read it, so nothing was overwritten.",
      next: "Re-read the latest version of the item and re-apply your edit against it.",
      actions: [
        { id: "reread", label: "Re-read item", command: "isocan get <item>" },
        { id: "versions", label: "Check versions", command: "isocan versions <item>" },
      ],
      retryable: true,
    };
  }

  // 2. Rate limit / quota exhaustion
  if (
    kind === "rate-limit" ||
    kind === "quota" ||
    code === "rate-limit" ||
    code === "rate_limit_exceeded" ||
    code === "resource_exhausted" ||
    status === 429 ||
    /\brate[\s_-]?limit|\btoo many requests|\bquota\b/i.test(detail)
  ) {
    return {
      headline: `${subject} hit a rate limit`,
      why: detail || `${subject} temporarily rejected requests because the quota or rate limit was reached.`,
      next: "Wait a moment and retry, or switch to another model.",
      actions: [
        { id: "retry", label: "Retry" },
        { id: "switch-model", label: "Try another model", command: "isocan models" },
      ],
      retryable: true,
    };
  }

  // 3. Missing key / auth / admission refusal
  if (
    kind === "auth" ||
    kind === "missing-key" ||
    kind === "permission" ||
    code === "unauthorized" ||
    code === "forbidden" ||
    code === "not-admitted" ||
    code === "missing-key" ||
    code === "invalid-key" ||
    status === 401 ||
    status === 403 ||
    /\bunauthorized\b|\binvalid api key\b|\bapi key\b|\bpermission denied\b/i.test(detail)
  ) {
    const providerHint = input.provider ? ` for ${input.provider}` : "";
    return {
      headline: status === 403 ? "Access refused" : `Authentication failed${providerHint}`,
      why: detail || `Credentials${providerHint} were missing, expired, or rejected.`,
      next: status === 403
        ? "Check that your badge or account has edit access on this canvas."
        : `Configure a valid key${providerHint} and retry.`,
      actions: status === 403
        ? [{ id: "who", label: "Check identity", command: "isocan whoami" }]
        : [{ id: "keys", label: "Configure API key", command: "isocan keys --mine" }],
      retryable: false,
    };
  }

  // 4. Timeout / cancellation
  if (
    kind === "timeout" ||
    kind === "aborted" ||
    code === "timeout" ||
    code === "aborted" ||
    status === 408 ||
    status === 504 ||
    /\btimed?\s*out\b|\bdeadline exceeded\b/i.test(detail)
  ) {
    return {
      headline: `${subject} timed out`,
      why: detail || `${subject} did not finish within the allowed time window.`,
      next: "Retry the operation, or check whether the daemon or provider is slow.",
      actions: [{ id: "retry", label: "Retry" }],
      retryable: true,
    };
  }

  // 5. Missing target (item, canvas, thread, session)
  if (
    kind === "not-found" ||
    code === "unknown-item" ||
    code === "unknown-canvas" ||
    code === "unknown-thread" ||
    code === "unknown-session" ||
    status === 404
  ) {
    return {
      headline: "Target not found",
      why: detail || "The referenced item, thread, or canvas does not exist or was moved to the trash.",
      next: "Refresh the canvas listing to verify the current ids.",
      actions: [{ id: "ls", label: "List canvas items", command: "isocan ls" }],
      retryable: false,
    };
  }

  // 6. Upstream / transient server failure
  if (
    kind === "unavailable" ||
    kind === "network" ||
    code === "unavailable" ||
    (status !== undefined && status >= 500) ||
    /\beconnrefused\b|\bfetch failed\b|\bservice unavailable\b/i.test(detail)
  ) {
    return {
      headline: `${subject} is temporarily unavailable`,
      why: detail || `${subject} returned a server or network error.`,
      next: "Retry shortly; if this persists, verify the daemon or provider status.",
      actions: [
        { id: "retry", label: "Retry" },
        { id: "status", label: "Check daemon status", command: "isocan status" },
      ],
      retryable: true,
    };
  }

  // 7. Validation / malformed request
  if (kind === "validation" || code === "bad-op" || code === "bad-request" || status === 400) {
    return {
      headline: "Invalid request",
      why: detail || "The operation arguments failed validation.",
      next: "Adjust the arguments and try again.",
      actions: [],
      retryable: false,
    };
  }

  // 8. Generic fallback
  return {
    headline: input.model || input.provider ? `${subject} failed` : "Operation failed",
    why: detail || "An unexpected error prevented the operation from completing.",
    next: "Inspect the error details and retry if the problem is transient.",
    actions: [{ id: "retry", label: "Retry" }],
    retryable: true,
  };
}

/** One-line failure annotation embedded inside the context graph. */
export function formatFailureForGraph(failure: PlainFailure): string {
  return `(FAILED: ${failure.headline} — ${failure.why})`;
}

/** Multi-line human-readable rendering for CLI stderr. */
export function formatFailureForCli(failure: PlainFailure): string {
  const lines = [`error: ${failure.headline} — ${failure.why}`, `  next: ${failure.next}`];
  for (const action of failure.actions) {
    if (action.command) lines.push(`  try:  ${action.command} (${action.label})`);
  }
  return lines.join("\n");
}
