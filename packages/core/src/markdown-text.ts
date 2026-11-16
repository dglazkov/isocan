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

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkRehype from "remark-rehype";
import type { Root, RootContent } from "hast";

/** The text nodes react-markdown renders, in logical order. Generated HAST
 * newlines count, markup/checkboxes/images do not, and raw HTML is literal text
 * (the renderer's default). This is a separate, lazy core entry point so the
 * parser never enters the canvas shell merely because it knows about presence. */
export function markdownText(source: string, flavor: "document" | "text-node" | "plain" = "document"): string {
  if (flavor === "plain") return source;
  const processor = unified().use(remarkParse).use(remarkGfm);
  if (flavor === "text-node") processor.use(remarkBreaks);
  processor.use(remarkRehype, { allowDangerousHtml: true });
  const tree = processor.runSync(processor.parse(source)) as Root;
  const text = (node: Root | RootContent): string => {
    if (node.type === "text" || node.type === "raw") return node.value;
    if (!("children" in node)) return "";
    // React's HAST runtime drops whitespace directly inside table structures.
    // Retaining it here shifts every CLI range after the first table cell.
    const table = node.type === "element" && ["table", "thead", "tbody", "tfoot", "tr"].includes(node.tagName);
    return node.children.filter(child => !(table && child.type === "text" && /^[\t\n\r ]*$/.test(child.value))).map(text).join("");
  };
  return text(tree);
}
