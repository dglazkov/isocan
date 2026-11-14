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
 * **A read that answers in time, or is told it failed.**
 *
 * The signal cancels the fetch, but a signal alone is not a deadline: a
 * request can be waiting on something no signal reaches — the door's
 * recovery, a shared re-claim — and an aborted signal nobody checks leaves
 * the caller on "Loading…" for good. So the answer is raced against the
 * clock as well, and the clock always wins at `ms`: the caller hears
 * `message`, whatever the read was waiting on.
 *
 * Its own module, not `api.ts`: the canvas list (a lazy route) is its one
 * caller, and in `api.ts` it rode every first visit's entry chunk.
 */
export function withDeadline<T>(ms: number, message: string, read: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const late = new Error(message);
      controller.abort(late);
      reject(late);
    }, ms);
    read(controller.signal).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err: unknown) => { clearTimeout(timer); reject(err); },
    );
  });
}
