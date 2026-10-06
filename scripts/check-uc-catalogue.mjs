import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const text = await readFile(new URL("../docs/requirements/uc.md", import.meta.url), "utf8");
const rows = text.split(/\r?\n/).filter(line => /^\| UC-\d{3} \|/.test(line));
const ids = new Set();
const counts = { Implemented: 0, Partial: 0, Planned: 0 };
for (const row of rows) {
  const cells = row.split("|").map(cell => cell.trim());
  assert.ok(!ids.has(cells[1]), "Duplicate UC: " + cells[1]);
  ids.add(cells[1]);
  assert.ok(cells[5] in counts, "Unknown status: " + cells[5]);
  counts[cells[5]]++;
}
for (const [status, count] of Object.entries(counts)) {
  assert.ok(text.includes("**" + status + ":** " + count + " use cases"), "Stale catalogue total: " + status);
}
assert.ok(text.includes("**Total:** " + ids.size + " business use cases"), "Stale total");
console.log(JSON.stringify({ total: ids.size, ...counts }));
