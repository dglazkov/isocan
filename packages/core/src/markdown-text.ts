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
