/** The text nodes react-markdown renders, in logical order. Generated HAST
 * newlines count, markup/checkboxes/images do not, and raw HTML is literal text
 * (the renderer's default). This is a separate, lazy core entry point so the
 * parser never enters the canvas shell merely because it knows about presence. */
export declare function markdownText(source: string, flavor?: "document" | "text-node" | "plain"): string;
