/** Human output = aligned tables; --json = machine output. */

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function printTable(rows: Array<Record<string, string>>): void {
  if (rows.length === 0) {
    console.log("(none)");
    return;
  }
  const columns = Object.keys(rows[0]!);
  const widths = columns.map((col) =>
    Math.max(col.length, ...rows.map((row) => (row[col] ?? "").length)),
  );
  const line = (cells: string[]) =>
    cells.map((cell, i) => cell.padEnd(widths[i]!)).join("  ").trimEnd();
  console.log(line(columns.map((c) => c.toUpperCase())));
  for (const row of rows) {
    console.log(line(columns.map((col) => row[col] ?? "")));
  }
}

export function printKeyValues(pairs: Record<string, string>): void {
  const width = Math.max(...Object.keys(pairs).map((k) => k.length));
  for (const [key, value] of Object.entries(pairs)) {
    console.log(`${key.padEnd(width)}  ${value}`);
  }
}

export function truncate(text: string, max = 40): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function formatProps(properties: Record<string, string>): string {
  return Object.entries(properties)
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
}

/** Parse repeated `--prop k=v` flags. */
export function collectProp(value: string, previous: Record<string, string>): Record<string, string> {
  const eq = value.indexOf("=");
  if (eq <= 0) throw new Error(`--prop expects key=value, got: ${value}`);
  return { ...previous, [value.slice(0, eq)]: value.slice(eq + 1) };
}

export function parseXY(value: string): { x: number; y: number } {
  const match = value.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if (!match) throw new Error(`expected x,y coordinates, got: ${value}`);
  return { x: Number(match[1]), y: Number(match[2]) };
}
