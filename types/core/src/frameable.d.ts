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
 * **Whether a site will let itself be shown inside a frame.**
 *
 * "Add site" projects a live site into an item, and an item is an iframe. Most
 * of the public web refuses that: `X-Frame-Options` and CSP `frame-ancestors`
 * exist precisely to stop a page being embedded by somebody else, and a bank
 * or a mail provider is right to send them.
 *
 * The failure was silent, which is the part worth fixing. Typing `yahoo.com`
 * created the item, the browser refused to render it, and the canvas showed a
 * blank rectangle with no explanation — so the honest report is "it didn't
 * work", and the honest answer is that it worked exactly as built and nobody
 * said what happened.
 *
 * This CANNOT be asked from the page: a cross-origin frame that has been
 * blocked looks, from JavaScript, much like one that loaded. The headers are
 * the fact, and only something that can make the request server-side can read
 * them — which is why this is a pure function over headers and the daemon is
 * what fetches them.
 */
interface FrameVerdict {
    /** The site permits framing by this app, as far as its headers say. */
    ok: boolean;
    /** The header that refused, verbatim, so the reason is the site's own words. */
    refusedBy?: string;
    /** What a person should be told. Empty when `ok`. */
    why?: string;
}
/** The verdict for one site, from the headers it answered with. */
export declare function frameVerdict(headers: {
    get(name: string): string | null;
}, self?: string | null): FrameVerdict;
export {};
