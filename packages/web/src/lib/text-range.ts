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

/** Map code-point offsets in markdown-hast-v1 to this renderer's text nodes.
 * The root contains only rendered document content, never toolbars or labels. */
export function rangeFromText(root: HTMLElement, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let position = 0;
  let first: [Node, number] | undefined;
  let last: [Node, number] | undefined;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const chars = Array.from(node.textContent ?? "");
    if (!first && start >= position && start < position + chars.length) first = [node, chars.slice(0, start - position).join("").length];
    if (end > position && end <= position + chars.length) last = [node, chars.slice(0, end - position).join("").length];
    position += chars.length;
  }
  if (!first || !last || end <= start) return null;
  const range = document.createRange();
  range.setStart(...first); range.setEnd(...last);
  return range;
}

/** DOM Range strings count text nodes rather than CSS line wrapping. Convert
 * their UTF-16 boundary offsets to the wire's Unicode code-point coordinates. */
export function rangeToText(root: HTMLElement, selection: Selection | null): { start: number; end: number } | null {
  if (!selection?.rangeCount || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const prefix = document.createRange();
  prefix.selectNodeContents(root); prefix.setEnd(range.startContainer, range.startOffset);
  const start = Array.from(prefix.toString()).length;
  const end = start + Array.from(range.toString()).length;
  return end > start ? { start, end } : null;
}
