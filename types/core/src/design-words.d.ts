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
 * **Design words: the small glossary behind every dotted underline**
 * (proactive-agent design §2.4, phase 1).
 *
 * A proposal's why is said in design words so the person learns the language
 * by seeing their own work described in it — never by a tutorial. That only
 * teaches if a term can be asked about where it stands, so every surface that
 * shows a why underlines the terms it knows and defines each in place. This
 * table is the one list: term, a one-line definition, and the plain phrases a
 * person types that mean it (which §12 will read for the composer).
 *
 * Deterministic and small on purpose: a model is not needed to underline a
 * word, and a glossary nobody can read in one sitting is not a glossary.
 */
interface DesignWord {
    /** The term as a designer says it, lower case. */
    term: string;
    /** One line, plain, that a person reads under a pointer. */
    means: string;
    /** What a person types when they mean this — for the composer's readings (§12). */
    plain: readonly string[];
}
/** One run of a sentence: plain words, or a known term with its definition. */
type WordSpan = {
    text: string;
    word?: DesignWord;
};
/**
 * **A sentence split at the terms it uses** — the underline's data. Longest
 * term first, case-insensitive, whole words only, each occurrence its own
 * span; everything else is plain text. Concatenating the spans' text gives
 * the sentence back exactly.
 */
export declare function designWordSpans(text: string): WordSpan[];
/**
 * **The plain phrases a sentence uses, each beside the term that means it**
 * — Explain's *speak design* (proactive-agent phase 4): "make it more
 * obvious" → *visual hierarchy*. Case-insensitive, whole words, the phrase
 * as it was typed; one reading per phrase, in the order they appear.
 */
export declare function plainReadings(text: string): {
    said: string;
    term: string;
    means: string;
}[];
/** **Every term the glossary defines** — what the vocabulary panel (§12) counts as a design word. */
export declare function glossaryTerms(): string[];
export {};
