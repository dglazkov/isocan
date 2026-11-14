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

import type { RendererFacts } from "@isocan/core";
import { EXACT_PROPS } from "./core.ts";
import { HOST_NAMES, type Host } from "./hosts.ts";
import { opWords, parseProposalRecord, previewRows, type PreviewCell } from "./proposal.ts";

/**
 * **A proposal, before and after on every device** (exact phase 6; journey
 * Scene 6). The item is core's proposal — the canvas draws it dashed, with its
 * trigger and why, and Keep and Delete are the canvas's own — and an ordinary
 * PNG: its current version is the screen it hangs under as the proposal would
 * draw it, which a Keep folds in. Its other versions are the pictures: each
 * host, device and scheme, before and as proposed. This draws them side by
 * side; with the module gone the version slider walks the same pictures.
 */
export function ProposalCard(facts: RendererFacts) {
  const { item, url, blobHash, filename } = facts;
  const record = parseProposalRecord(item?.properties?.[EXACT_PROPS.proposal]);
  if (!item || !record) return <img className="img-view" src={url} alt={filename} draggable={false} />;
  const src = (versionId: string | undefined) => {
    const hash = item.versions.find((v) => v.id === versionId)?.blobHash;
    return hash ? (url.includes(blobHash) ? url.replace(blobHash, hash) : url) : null;
  };
  const rows = previewRows(record.previews);
  const cell = (c: PreviewCell | null, side: "before" | "after") => {
    const s = c ? src(c[side]) : null;
    return (
      <td key={`${c?.scheme ?? "x"}-${side}`} className={`exact-proposal-cell exact-proposal-${side}`}>
        {s ? <img src={s} alt={`${c!.host} ${c!.device} ${c!.scheme} ${side === "before" ? "before" : "as proposed"}`} draggable={false} data-exact-cell={`${c!.host}/${c!.device}/${c!.scheme}/${side}`} /> : <span className="exact-note">—</span>}
      </td>
    );
  };
  const asker = record.asker.kind === "agent" ? `${record.asker.name}, an agent — propose scope, never write` : `${record.asker.name} — write scope`;
  return (
    <div className="exact-proposal" data-exact-proposal={record.proposal} data-exact-class={record.class} data-exact-scope={record.scope} data-exact-pictures={record.previews.length}>
      <div className="exact-proposal-head">
        <strong>{asker}</strong>
        <span className="exact-note">
          {record.class === "live" ? "live: pictured as a Tamber scrub, cancelled" : "rebuild: pictured in a staged copy"} · held on the wire as {record.proposal} ({record.client})
        </span>
        <ul className="exact-proposal-ops">{record.ops.map((op, i) => <li key={i}><code>{opWords(op)}</code></li>)}</ul>
        <span className="exact-note">Nothing is written until a person keeps it: Keep is Tamber's accept.</span>
      </div>
      <table className="exact-proposal-grid">
        <thead>
          <tr><th /><th colSpan={2}>light</th><th colSpan={2}>dark</th></tr>
          <tr><th /><th>before</th><th>proposed</th><th>before</th><th>proposed</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.host}-${r.device}`}>
              <th>{r.host === "web" ? r.device : `${HOST_NAMES[r.host as Host] ?? r.host}`}</th>
              {cell(r.light, "before")}{cell(r.light, "after")}{cell(r.dark, "before")}{cell(r.dark, "after")}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
