import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DesignDoc, DesignTypography } from "@isocan/core";
import { parseDesign, parseHex, resolveToken } from "@isocan/core";
import { lengthPx, readableInk } from "../lib/designview.ts";
import { fetchBlobText, peekBlobText, type TextLoad } from "../lib/blobtext.ts";

/**
 * A design system, shown as itself.
 *
 * `parseDesign` has always turned a DESIGN.md into a real model — colours,
 * type with its actual metrics, spacing, radii, components whose values are
 * `{colors.primary}` references — and the app rendered none of it. A design
 * system arrived on the canvas as a wall of collapsed key/value text, which is
 * the one thing a document about how things should look must not be.
 *
 * So every token is drawn AS THE THING IT DESCRIBES: a colour is a swatch, a
 * type style is set in its own family at its own size, a spacing step is a bar
 * that long, a radius is a corner that round. The values sit beside them,
 * because this is a specification and somebody has to be able to copy the
 * number.
 *
 * Two things this can do that a picture of a design system cannot. It resolves
 * `{colors.x}` through the same `resolveToken` the CLI uses, so a component's
 * swatch is the colour it will actually be. And it measures contrast with the
 * repo's own `contrastRatio`, so a palette that cannot carry text says so here
 * rather than in an audit three weeks later.
 */
export function DesignSystemView({ url }: { url: string }) {
  const [load, setLoad] = useState<TextLoad>(() => {
    const cached = peekBlobText(url);
    return cached === undefined ? null : { text: cached };
  });

  useEffect(() => {
    let cancelled = false;
    fetchBlobText(url)
      .then((body) => !cancelled && setLoad({ text: body }))
      .catch((err: Error) => !cancelled && setLoad({ failed: err.message }));
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (load === null) return <div className="file-view">…</div>;
  if ("failed" in load) return <div className="file-view">{load.failed}</div>;

  const doc = parseDesign(load.text);
  return (
    <div className="ds-view">
      <Masthead doc={doc} />
      {doc.problems.length > 0 && (
        <section className="ds-problems">
          <h3>Could not be read</h3>
          <ul>
            {doc.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      )}
      <Colors doc={doc} />
      <Type doc={doc} />
      <Scale doc={doc} />
      <Corners doc={doc} />
      <Components doc={doc} />
      {doc.sections.length > 0 && (
        <section className="ds-prose">
          {doc.sections.map((s) => (
            <div key={s.title}>
              <h3>{s.title}</h3>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.body}</ReactMarkdown>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function Masthead({ doc }: { doc: DesignDoc }) {
  const { name, version, description } = doc.tokens;
  if (!name && !version && !description) return null;
  return (
    <header className="ds-masthead">
      <div className="ds-title">
        {name && <h2>{name}</h2>}
        {version && <span className="ds-version">{version}</span>}
      </div>
      {description && <p>{description}</p>}
    </header>
  );
}

function Colors({ doc }: { doc: DesignDoc }) {
  const colors = Object.entries(doc.tokens.colors ?? {});
  if (colors.length === 0) return null;
  return (
    <section className="ds-section">
      <h3>Colours <span>{colors.length}</span></h3>
      <div className="ds-swatches">
        {colors.map(([name, value]) => {
          const on = readableInk(value);
          return (
            <div className="ds-swatch" key={name}>
              <div className="ds-chip" style={{ background: value, color: on?.color ?? "inherit" }}>
                {on && <span className="ds-ratio">{on.ratio.toFixed(1)}</span>}
              </div>
              <b>{name}</b>
              <code>{value}</code>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** The declared style, as CSS, so the specimen is set in the thing described. */
function asCss(t: DesignTypography): React.CSSProperties {
  return {
    fontFamily: t.fontFamily,
    fontSize: t.fontSize,
    fontWeight: t.fontWeight as React.CSSProperties["fontWeight"],
    lineHeight: t.lineHeight,
    letterSpacing: t.letterSpacing,
  };
}

function Type({ doc }: { doc: DesignDoc }) {
  const styles = Object.entries(doc.tokens.typography ?? {});
  if (styles.length === 0) return null;
  return (
    <section className="ds-section">
      <h3>Typography <span>{styles.length}</span></h3>
      <div className="ds-type">
        {styles.map(([name, t]) => (
          <div className="ds-specimen" key={name}>
            <div className="ds-specimen-head">
              <b>{name}</b>
              <code>
                {[t.fontSize, t.fontWeight, t.lineHeight && `/${t.lineHeight}`, t.letterSpacing]
                  .filter(Boolean)
                  .join(" ")}
              </code>
            </div>
            {/* Set in its own face at its own size: the specimen IS the token. */}
            <p style={asCss(t)}>The quick brown fox jumps over the lazy dog</p>
            {t.fontFamily && <span className="ds-family">{t.fontFamily.split(",")[0]}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

function Scale({ doc }: { doc: DesignDoc }) {
  const steps = Object.entries(doc.tokens.spacing ?? {});
  if (steps.length === 0) return null;
  const drawable = steps.map(([n, v]) => [n, v, lengthPx(v)] as const);
  const widest = Math.max(...drawable.map(([, , n]) => n ?? 0), 1);
  return (
    <section className="ds-section">
      <h3>Spacing <span>{steps.length}</span></h3>
      <div className="ds-scale">
        {drawable.map(([name, value, n]) => (
          <div className="ds-step" key={name}>
            <b>{name}</b>
            {/* Drawn to scale against the largest step, so the RHYTHM is
                visible — the thing a table of numbers hides. */}
            <span className="ds-bar" style={{ width: `${((n ?? 0) / widest) * 100}%` }} />
            <code>{String(value)}</code>
          </div>
        ))}
      </div>
    </section>
  );
}

function Corners({ doc }: { doc: DesignDoc }) {
  const radii = Object.entries(doc.tokens.rounded ?? {});
  if (radii.length === 0) return null;
  return (
    <section className="ds-section">
      <h3>Radii <span>{radii.length}</span></h3>
      <div className="ds-radii">
        {radii.map(([name, value]) => (
          <div className="ds-radius" key={name}>
            <span style={{ borderRadius: value }} />
            <b>{name}</b>
            <code>{value}</code>
          </div>
        ))}
      </div>
    </section>
  );
}

function Components({ doc }: { doc: DesignDoc }) {
  const parts = Object.entries(doc.tokens.components ?? {});
  if (parts.length === 0) return null;
  return (
    <section className="ds-section">
      <h3>Components <span>{parts.length}</span></h3>
      <div className="ds-components">
        {parts.map(([name, props]) => (
          <div className="ds-component" key={name}>
            <b>{name}</b>
            <dl>
              {Object.entries(props).map(([k, v]) => {
                // `{colors.primary}` resolved through the same helper the CLI
                // uses, so the swatch is the colour it will actually be.
                const resolved = typeof v === "string" ? resolveToken(doc.tokens, v) : v;
                const shown = typeof resolved === "string" ? resolved : String(v);
                return (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>
                      {parseHex(shown) && <i className="ds-dot" style={{ background: shown }} />}
                      <code>{shown}</code>
                      {shown !== v && <span className="ds-ref">{v}</span>}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
