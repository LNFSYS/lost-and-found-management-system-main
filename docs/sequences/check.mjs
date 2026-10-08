import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const directory = path.join(root, "docs", "sequences");
const catalogue = fs.readFileSync(path.join(root, "docs", "requirements", "uc.md"), "utf8");
const rows = [];
let section = null;
let index = 0;
for (const line of catalogue.split(/\r?\n/)) {
  const heading = line.match(/^#{2,3} (3\.(\d+)) /);
  if (heading) {
    section = Number(heading[2]) >= 2 && Number(heading[2]) <= 17 ? heading[1] : null;
    index = 0;
  }
  if (section && /^\| UC-\d+ \|/.test(line)) {
    const cells = line.split("|").map(value => value.trim());
    rows.push({ section, number: `${section}.${++index}`, id: cells[1], name: cells[2], status: cells[5] });
  }
}

let messages = 0;
const counts = {};
function member(section) {
  const number = Number(section.split(".")[1]);
  return number <= 4 ? "Dat" : number <= 8 ? "Tran-The-Luong" : number <= 12 ? "Khoa" : "Q";
}
for (const row of rows) {
  const folder = path.join(directory, member(row.section), row.section);
  const matches = fs.readdirSync(folder).filter(name => name.startsWith(`${row.number}_${row.id}_`) && name.endsWith(".puml"));
  assert.equal(matches.length, 1, `Exactly one source required for ${row.id}`);
  const source = fs.readFileSync(path.join(folder, matches[0]), "utf8");
  const participants = new Set([...source.matchAll(/^(?:actor|participant) "[^"]+" as (\w+)/gm)].map(match => match[1]));
  assert(source.includes(`title ${row.number} ${row.name}`), `${row.id}: catalogue title`);
  assert(source.includes(`caption ${row.id} | ${row.status}`), `${row.id}: catalogue status`);
  const entities = [...source.matchAll(/^participant "([^"]+)" as Table <<(entity|proposed entity)>>$/gm)];
  assert.equal(entities.length, 1, `${row.id}: exactly one named entity`);
  const [entity] = entities;
  if (entity[2] === "proposed entity") {
    assert.equal(row.status, "Planned", `${row.id}: proposed table must not be certified as implemented`);
    assert(source.includes("Proposed design"), `${row.id}: proposed label`);
  } else {
    const migration = source.match(/^' Main entity migration: (.+)$/m)?.[1];
    assert(migration, `${row.id}: migration reference`);
    const sql = fs.readFileSync(path.join(root, migration), "utf8");
    assert(new RegExp(`CREATE TABLE(?: IF NOT EXISTS)?\\s+${entity[1]}\\b`, "i").test(sql), `${row.id}: exact table creation`);
  }
  const evidence = source.match(/^' Source: (.+)$/m)?.[1];
  assert(evidence && fs.existsSync(path.join(root, evidence)), `${row.id}: source evidence exists`);
  if (row.status === "Planned") assert(source.includes("Proposed design"), `${row.id}: planned design label`);

  // Alternatives start at the next shared step, not the previous step number.
  const frames = [];
  const active = new Map();
  const labels = new Set();
  let last = 0;
  for (const line of source.split(/\r?\n/)) {
    if (/^\s*alt /.test(line)) frames.push({ type: "alt", checkpoint: last, successEnd: null, alternate: false, next: 1 });
    else if (/^\s*loop /.test(line)) frames.push({ type: "loop" });
    else if (/^\s*else /.test(line)) {
      const frame = frames.at(-1);
      assert.equal(frame?.type, "alt", `${row.id}: unmatched else`);
      frame.successEnd ??= last;
      frame.alternate = true;
      last = frame.checkpoint;
    } else if (/^\s*end\s*$/.test(line)) {
      const frame = frames.pop();
      assert(frame, `${row.id}: unmatched end`);
      if (frame.type === "alt") last = frame.successEnd ?? last;
    }
    const message = line.match(/^\s*\w+\s+--?>\s+\w+:\s*(\d+)(?:\.(\d+))?:/);
    if (message) {
      const endpoints = line.match(/^\s*(\w+)\s+--?>\s+(\w+):/);
      assert(participants.has(endpoints[1]) && participants.has(endpoints[2]), `${row.id}: undefined lifeline`);
      const whole = Number(message[1]);
      const suffix = message[2] && Number(message[2]);
      const label = suffix ? `${whole}.${suffix}` : `${whole}`;
      assert(!labels.has(label), `${row.id}: duplicate step ${label}`);
      labels.add(label);
      if (suffix) {
        const frame = [...frames].reverse().find(value => value.type === "alt");
        assert(frame?.alternate, `${row.id}: decimal label outside alternative`);
        assert.equal(whole, frame.checkpoint + 1, `${row.id}: alternative base ${label}`);
        assert.equal(suffix, frame.next++, `${row.id}: alternative order ${label}`);
      } else {
        assert.equal(whole, last + 1, `${row.id}: main step order ${label}`);
        last = whole;
      }
      messages++;
    }
    const activation = line.match(/^\s*(activate|deactivate)\s+(\w+)\s*$/);
    if (activation) {
      const [, command, participant] = activation;
      const depth = (active.get(participant) ?? 0) + (command === "activate" ? 1 : -1);
      assert(depth >= 0, `${row.id}: unmatched deactivation ${participant}`);
      active.set(participant, depth);
    }
  }
  assert.equal(frames.length, 0, `${row.id}: unclosed frame`);
  assert([...active.values()].every(value => value === 0), `${row.id}: unclosed activation`);
  assert(active.has("Table"), `${row.id}: missing entity activation`);
  const png = fs.readFileSync(path.join(folder, matches[0].replace(/\.puml$/, ".png")));
  assert(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${row.id}: PNG signature`);
  assert(png.length > 1000 && png.readUInt32BE(16) > 500 && png.readUInt32BE(20) > 300, `${row.id}: nonempty rendered image`);
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    assert(offset + 12 + length <= png.length, `${row.id}: truncated PNG chunk`);
    if (["tEXt", "zTXt", "iTXt"].includes(type)) {
      const chunk = png.subarray(offset + 8, offset + 8 + length);
      // PlantUML retains a plain generator credit, but not source metadata.
      assert.equal(type, "tEXt", `${row.id}: embedded compressed/source metadata`);
      assert.equal(chunk.toString("utf8"), "copyleft\0Generated by https://plantuml.com", `${row.id}: unexpected embedded text`);
    }
    offset += length + 12;
  }
  counts[row.section] = (counts[row.section] ?? 0) + 1;
}
for (const [section, count] of Object.entries(counts)) {
  const entries = fs.readdirSync(path.join(directory, member(section), section));
  assert.equal(entries.filter(name => name.endsWith(".puml")).length, count, `${section}: extra sources`);
  assert.equal(entries.filter(name => name.endsWith(".png")).length, count, `${section}: extra images`);
}
assert.equal(rows.length, 167, "All business UCs in sections 3.2-3.17");
assert(fs.existsSync(path.join(directory, "Dat", "3.1", "README.md")), "Explain the non-business section 3.1");
for (const relative of ["README.md", "Dat/README.md", "Dat/3.1/README.md", "Tran-The-Luong/README.md", "Khoa/README.md", "Q/README.md"]) {
  const filename = path.join(directory, relative);
  const readme = fs.readFileSync(filename, "utf8");
  for (const match of readme.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
    if (!/^https?:/.test(match[1])) assert(fs.existsSync(path.resolve(path.dirname(filename), match[1])), `Broken index link in ${relative}: ${match[1]}`);
  }
}
console.log(JSON.stringify({ result: "PASS", useCases: rows.length, groups: counts, numberedMessages: messages }, null, 2));
