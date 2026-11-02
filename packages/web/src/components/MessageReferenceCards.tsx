import type { Comment } from "@isocan/core";
import { commentReferencedItemIds } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { ItemCard } from "./MainThreadPanel.tsx";

/**
 * The phone can enter only recorded references; the frozen disclosure stays
 * separate. Handed to the Chat by the phone (`MainThreadBody`'s `refCards`)
 * rather than drawn by the Chat itself, because only the phone ever showed
 * these — and the docked Chat is on the entry chunk (24 Sep 2026).
 */
export function MessageReferenceCards({ canvasId, comment, onOpenItem }: {
  canvasId: string; comment: Comment; onOpenItem: (id: string) => void;
}) {
  const canvas = useCanvasStore((s) => s.canvas);
  const ids = canvas ? commentReferencedItemIds(canvas, comment) : [];
  if (!ids.length) return null;
  const label = comment.context ? "Request context" : "Linked in this message";
  return <section className="message-reference-cards" aria-label={label}>
    <small>{label} · current preview</small>
    {ids.map((id) => <ItemCard key={id} canvasId={canvasId} itemId={id} onOpenItem={onOpenItem} />)}
  </section>;
}
