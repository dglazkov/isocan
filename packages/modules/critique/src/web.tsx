import { useEffect, useState } from "react";
import type { RendererFacts, WebModule } from "@isocan/core";
import { CRITIC_PROP, critiqueCore, readCritic, type Critic } from "./core.ts";

/**
 * **A critic, drawn as a card** — its name, the credit line, its colour and
 * its three questions. The whole web half, fetched only once the `critique`
 * experiment is on (`packages/web/src/modules.ts`); without it the same item
 * is the markdown note it always was.
 *
 * Read through `readCritic`, the reader `isocan critic ls` uses, so the card
 * and the terminal cannot disagree about what a critic says. A card that no
 * longer parses as a critic says so rather than drawing an empty one.
 */
function CriticCard({ readText, filename }: RendererFacts) {
  const [critic, setCritic] = useState<Critic | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    readText().then((text) => { if (live) setCritic(readCritic(text, filename)); }, () => { if (live) setCritic(null); });
    return () => { live = false; };
  }, [readText, filename]);
  if (critic === undefined) return null;
  if (critic === null) return <div className="file-view">Not a critic any more — its front matter needs <code>critic: true</code>.</div>;
  const colour = critic.color ?? "currentColor";
  return (
    <article className="critic-card" style={{ borderTop: `6px solid ${colour}`, padding: "16px 18px", height: "100%", boxSizing: "border-box", overflow: "auto" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden style={{ width: 14, height: 14, borderRadius: "50%", background: colour, flex: "none" }} />
        <h3 style={{ margin: 0, fontSize: 20 }}>{critic.agentName || critic.name}</h3>
      </header>
      <p style={{ margin: "4px 0 12px 24px", opacity: 0.7, fontSize: 13 }}>{critic.credit}</p>
      <ol style={{ margin: 0, paddingLeft: 24, display: "grid", gap: 8 }}>
        {critic.questions.map((q, i) => <li key={i}>{q || <em style={{ opacity: 0.6 }}>unwritten</em>}</li>)}
      </ol>
    </article>
  );
}

/** The web half: one renderer, claiming only markdown items marked as critics. */
export const critiqueWeb: WebModule<never, typeof CriticCard> = {
  core: critiqueCore,
  renderers: [{ mimes: ["text/markdown"], property: CRITIC_PROP, component: CriticCard }],
};

export default critiqueWeb;
