import type { AuditRange, ScreenAudit } from "@isocan/core";

/** The effective governing contract and each active grant remain inspectable beside source findings. */
export function DesignContractSummary({ policy, onSelect }: { policy: ScreenAudit["policy"]; onSelect: (range: AuditRange) => void }) {
  const contract = policy.effective;
  return <div className="design-lint-policy" data-design-policy={policy.status} data-design-literals={contract?.literals ?? "unexamined"}>
    <p><strong>Effective policy:</strong> {contract ? contract.literals === "require-references" ? "token references required" : "exact token literals allowed" : "unsupported — rules unexamined"}{policy.status === "default" ? " (default)" : policy.status === "partial" ? " (partly supported)" : ""}.</p>
    {policy.problems.length > 0 && <div className="design-lint-policy-problems"><strong>Unsupported policy rules</strong><ul>{policy.problems.map((problem, index) => <li key={`${problem.path}:${index}`}><code>{problem.path}</code>: {problem.message} <span>({problem.code})</span></li>)}</ul></div>}
    {policy.appliedTreatments.map((treatment, index) => <p key={`${treatment.name}:${index}`} data-design-treatment={treatment.name}><button type="button" className="design-lint-location" onClick={() => onSelect(treatment.range)}>Line {treatment.range.start.line}</button> · <strong>{treatment.recipe}</strong> treatment <code>{treatment.name}</code> applied.</p>)}
    {policy.appliedExceptions.map((exception, index) => <p key={`${exception.name}:${index}`} data-design-exception={exception.name}><button type="button" className="design-lint-location" onClick={() => onSelect(exception.range)}>Line {exception.range.start.line}</button> · <strong>{exception.recipe}</strong> exception <code>{exception.name}</code> for {exception.properties.join(", ")}: {exception.reason}</p>)}
    {contract && (Object.keys(contract.recipes).length > 0 || Object.keys(contract.exceptions).length > 0) && <details className="design-lint-contract"><summary>Recipes and approved exceptions</summary>
      {Object.entries(contract.recipes).map(([name, recipe]) => <div key={name}><strong>{name}</strong>
        <ul>{Object.entries(recipe.owns).map(([property, value]) => <li key={property}>Owns <code>{property}: {value}</code></li>)}</ul>
        <p>Caller controls: {recipe.allow.length ? recipe.allow.join(", ") : "none declared"}.</p>
        {Object.entries(recipe.treatments).map(([name, values]) => <p key={name}>Treatment <code>{name}</code>: {Object.entries(values).map(([property, value]) => `${property}: ${value}`).join("; ")}.</p>)}
      </div>)}
      {Object.entries(contract.exceptions).map(([name, exception]) => <p key={name}>Exception <code>{name}</code> · {exception.recipe} · {exception.properties.join(", ")}: {exception.reason}</p>)}
    </details>}
    <p className="design-lint-footnote">{policy.boundary}</p>
    {(policy.original !== null || policy.status === "unsupported") && <details className="design-lint-original"><summary>Original isocan extension</summary><pre>{JSON.stringify(policy.original, null, 2)}</pre></details>}
  </div>;
}
