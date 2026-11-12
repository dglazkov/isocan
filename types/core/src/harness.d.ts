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
/** Harness classification shared by actor claims and session headers.
 * Kept separate so reading an attestation does not load the actor registry writer. */
/**
 * The harnesses a PERSON claims from. Everything else — a coding harness,
 * an enrolment (`agent:`), a bot on a timer (`board:`) — is an agent. The
 * list is of people rather than of agents because new harnesses appear
 * (`harnessVars` in config.json) and a new one should be an agent by
 * default: the failure mode of guessing wrong the other way is a corpus
 * that counts a bot's receipts as somebody asking.
 */
export declare const PERSON_HARNESSES: ReadonlySet<string>;
/**
 * Is this harness an agent's? Anything not a known person's harness is — empty or missing
 * is neither, and reads as not an agent.
 */
export declare const isAgentHarness: (harness: string | null | undefined) => boolean;
