import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const outputDir = dirname(fileURLToPath(import.meta.url));
const cataloguePath = resolve(outputDir, "../../requirements/uc.md");
const source = await readFile(cataloguePath, "utf8");
const catalogue = new Map();
let section = "";
for (const line of source.split(/\r?\n/)) {
  if (/^### 3\./.test(line)) section = line.slice(4);
  if (!/^\| UC-\d{3} \|/.test(line)) continue;
  const [, id, name, actors, description, status] = line.split("|").map(cell => cell.trim());
  assert.ok(!catalogue.has(id), `Duplicate catalogue ID: ${id}`);
  catalogue.set(id, { id, name, actors, description, status, section });
}
assert.equal(catalogue.size, 168, "Review diagram coverage when the catalogue changes");

const ucId = number => `UC-${String(number).padStart(3, "0")}`;
const automaticIds = new Set([29, 30, 31, 57, 60, 86, 100, 103, 110, 134, 138, 139, 150].map(ucId));
const root = (number, children = []) => ({ id: ucId(number), children });
const include = (number, children = []) => ({ ...root(number, children), relation: "include" });
const extend = (number, condition, children = []) => ({ ...root(number, children), relation: "extend", condition });
const required = (name, reference) => ({ name, reference, relation: "include", children: [] });
const group = (title, roots) => ({ title, roots });

const account = () => group("Account and profile", [
  root(4), root(5),
  root(8, [extend(9, "edit profile", [extend(10, "replace avatar")]), extend(11, "view avatar")]),
  root(12),
]);
const publicBoard = () => group("Public board and reference information", [
  root(13, [extend(14, "search or filter")]), root(15, [extend(24, "view post image")]), root(49), root(86),
]);
const notifications = (participant = false) => group("Notifications and delivery preferences", [
  root(46, [extend(47, "read one notification"), extend(48, "mark all as read")]),
  ...(participant ? [root(123), root(124), root(125)] : []), root(168),
]);
const reports = (participant = false) => group("Reports and personal report tracking", [
  root(93, participant ? [extend(140, "handover issue")] : []),
  root(94, [extend(95, "open report", [extend(96, "pending report")])]),
]);
const posts = found => group(found ? "FOUND publication and image assistance" : "LOST publication and image assistance", [
  root(13, [extend(14, "search or filter")]), root(15, [extend(24, "view post image")]),
  root(found ? 19 : 18, [
    include(16, [include(86)]), extend(17, "request image analysis"), extend(23, "attach item image"),
  ]),
  root(20), root(21, [extend(25, "remove owned image")]), root(22),
]);
const matching = () => group("Matching suggestions and automatic processing", [
  root(26, [extend(27, "recalculate"), extend(28, "inspect score"), extend(98, "dismiss suggestion"), extend(99, "rate suggestion")]),
  root(29, [include(30), include(31)]), root(97), root(100),
]);
const claims = found => group("Claims, consent and claim history", [
  root(32),
  root(33, [
    ...(found ? [extend(35, "accept request"), extend(36, "request clarification"), extend(37, "decline request")] : [extend(38, "withdraw request")]),
    extend(111, "request Staff support"), extend(164, "review claim history"),
  ]),
  root(34, [required(
    found ? "Check contact eligibility; enforce photo gate for LOST contact" : "Check claim eligibility, ownership roles and duplicate requests",
    found ? "BR-33, BR-53, BR-69" : "BR-33, BR-34",
  )]),
]);
const communication = found => group("Private conversation and ownership verification", [
  root(39), root(40, [include(41, [include(122)])]), root(42),
  root(43, [extend(45, "open evidence image")]), root(120, [include(44)]), root(121), root(119),
  ...(found ? [root(106, [extend(107, "send a question")]), root(109), root(115, [extend(116, "compare claimants")]), root(117), root(118)] : [root(108)]),
  root(110),
]);
const appointments = found => group("Appointments and direct physical return", [
  root(126, [extend(127, "open appointment")]),
  root(128, [required("Validate future time and exactly one permitted meeting location", "BR-37"), extend(49, "choose predefined point")]),
  root(129), root(130), root(131), root(132), root(133), root(135),
  root(found ? 136 : 137, [
    required("Check physical handover, active participants and unresolved blockers", "BR-72"),
    extend(138, "pending or conflicting responses"), extend(139, "both valid positive responses"),
  ]), root(134),
]);
const feedback = () => group("Feedback and reputation", [root(59, [include(58), include(60)])]);
const custodyUser = found => group("Custody and end-to-end item journey", [
  ...(found ? [root(141, [include(142)]), root(145)] : []), root(147), root(167),
]);
const staffMatching = () => group("Matching review and eligible example labels", [
  root(26, [extend(27, "recalculate"), extend(28, "inspect score")]), root(102),
]);
const intake = () => group("Physical intake, warehouse and custody requests", [
  root(50), root(51, [extend(56, "open history and photos")]),
  root(52, [include(57)]), root(53), root(54),
  root(55, [required("Verify actual recipient and record private return proof", "BR-57, BR-65"), required("Check reservation, competing cases, disputes and legal hold", "BR-55, BR-66")]),
  root(143, [extend(144, "review request")]), root(142), root(145), root(146),
]);
const escalation = () => group("Authorized escalation review", [
  root(112, [extend(113, "open escalated case", [extend(164, "review permitted history")])]), root(114),
]);
const retention = admin => group("Retention, legal hold and controlled disposition", [
  root(148, [extend(149, "open overdue item", [include(151)])]), root(150),
  ...(admin ? [root(152), root(153, [required("Recheck item eligibility and active hold/case restrictions", "BR-38, BR-55")])] : []),
  root(154),
  ...(admin ? [root(155, [required("Require an authorized approver different from the requester", "BR-55")]), root(156), root(157)] : []),
  root(158, [required("Recheck approved order, item eligibility and private proof", "BR-38, BR-55")]),
  ...(admin ? [root(159), root(160)] : []), root(161), ...(admin ? [root(162)] : []),
]);

const specifications = [
  {
    key: "01-guest", title: "Guest", actor: "Guest", role: "Guest", groups: [
      group("Registration, sign-in and account recovery", [
        root(1), root(2, [required("Validate registration OTP and assign permitted base roles", "BR-01, BR-02")]),
        root(3, [required("Validate credentials, active account and session eligibility", "BR-03, BR-04")]),
        root(6), root(7, [required("Validate reset code and invalidate existing sessions", "BR-03")]),
      ]), publicBoard(),
    ],
  },
  {
    key: "02-user-lost", title: "User - Lost (Claimant)", actor: "User", role: "Lost", groups: [
      account(), posts(false), matching(), claims(false), communication(false), appointments(false),
      feedback(), custodyUser(false), notifications(true), reports(true),
    ],
  },
  {
    key: "03-user-finder", title: "User - Finder", actor: "User", role: "Finder", groups: [
      account(), posts(true), matching(), claims(true), communication(true), appointments(true),
      feedback(), custodyUser(true), notifications(true), reports(true),
    ],
  },
  {
    key: "04-staff", title: "Staff", actor: "Staff", role: "Staff", groups: [
      account(), publicBoard(), staffMatching(), intake(), escalation(), retention(false), notifications(), reports(),
    ],
  },
  {
    key: "05-admin", title: "Admin", actor: "Admin", role: "Admin", groups: [
      account(), publicBoard(), staffMatching(), intake(), escalation(),
      group("User accounts and authorization administration", [
        root(62), root(63), root(64, [extend(65, "edit user profile"), extend(66, "change role"), extend(67, "enable or disable"), extend(68, "delete eligible account")]),
      ]),
      group("Master data and campus locations", [
        root(61), root(69), root(70), root(71), root(72), root(73), root(74), root(75), root(76), root(77),
        root(78), root(79, [extend(80, "replace map image")]), root(81),
      ]),
      group("Moderation, dashboard and system-wide audit", [
        root(82), root(83, [include(165)]), root(84, [extend(85, "export statistics")]), root(163, [extend(166, "export filtered audit")]),
      ]),
      group("Runtime system configuration", [root(87), root(88), root(89, [extend(90, "view change history")]), root(91), root(92)]),
      group("Matching model preparation and lifecycle", [root(101, [include(103)]), root(104), root(105)]),
      retention(true), notifications(), reports(),
    ],
  },
];

const xml = value => String(value).replace(/[&<>"'\n\r]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;", "\n": "&#xa;", "\r": "" })[c]);
const shortStatus = { Implemented: "I", Partial: "P", Planned: "PL" };
const nodeWidth = 400;
const nodeHeight = 124;
const rowHeight = 166;
const firstColumn = 310;
const columnStep = 600;
const treeRows = tree => Math.max(1, tree.children.reduce((sum, child) => sum + treeRows(child), 0));
function wrap(text, limit = 35) {
  const lines = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    if (current && (current + " " + word).length > limit) { lines.push(current); current = word; }
    else current = current ? current + " " + word : word;
  }
  if (current) lines.push(current);
  return lines;
}
function detailed(spec) {
  const d = { ...spec, nodes: [], edges: [], headings: [], actors: [], ids: new Set() };
  let cursor = 176;
  function place(tree, depth, y) {
    assert.ok(depth <= 2, `Too many columns in ${spec.key}`);
    const data = tree.id ? catalogue.get(tree.id) : tree;
    assert.ok(data, `Unknown use case ${tree.id}`);
    if (tree.id) {
      assert.ok(!d.ids.has(tree.id), `Duplicate ${tree.id} in ${spec.key}`);
      d.ids.add(tree.id);
    }
    const rows = treeRows(tree);
    const node = { key: tree.id ?? `support-${d.nodes.length}`, ...data, x: firstColumn + depth * columnStep, y: y + (rows * rowHeight - nodeHeight) / 2, w: nodeWidth, h: nodeHeight, auxiliary: !tree.id };
    d.nodes.push(node);
    if (depth === 0 && tree.id && !automaticIds.has(tree.id)) d.edges.push({ from: "actor", to: node.key, type: "association", side: "left" });
    let childCursor = y;
    for (const child of tree.children) {
      const childNode = place(child, depth + 1, childCursor);
      const isExtension = child.relation === "extend";
      d.edges.push({ from: isExtension ? childNode.key : node.key, to: isExtension ? node.key : childNode.key, type: child.relation, condition: child.condition });
      childCursor += treeRows(child) * rowHeight;
    }
    return node;
  }
  for (const g of spec.groups) {
    d.headings.push({ title: g.title, y: cursor + 18 });
    cursor += 58;
    for (const tree of g.roots) { place(tree, 0, cursor); cursor += treeRows(tree) * rowHeight; }
    cursor += 22;
  }
  d.height = cursor + 82;
  const rightmost = Math.max(...d.nodes.map(node => node.x + node.w));
  d.width = rightmost + 110;
  d.boundary = { x: 200, y: 44, w: rightmost - 140, h: d.height - 92 };
  d.actors.push({ key: "actor", name: spec.actor, x: 92, y: Math.round((d.height + 140) / 2) });
  d.subtitle = `${d.ids.size} catalogue UCs | I: Implemented | P: Partial | PL: Planned | [auto]: internal system behavior`;
  return d;
}

function overview() {
  const d = { key: "00-overview", title: "Overall Use Case Diagram", width: 2320, height: 2590, nodes: [], edges: [], headings: [], ids: new Set(), role: "Overview" };
  d.boundary = { x: 210, y: 54, w: 1895, h: 2468 };
  d.actors = [
    { key: "guest", name: "Guest", x: 85, y: 315 }, { key: "user", name: "User", x: 85, y: 1510 },
    { key: "staff", name: "Staff", x: 2220, y: 610 }, { key: "admin", name: "Admin", x: 2220, y: 1830 },
  ];
  const add = (key, name, column, y, refs) => {
    const node = { key, name, reference: refs, x: 300 + column * 605, y, w: 420, h: 120, overview: true };
    d.nodes.push(node);
    return node;
  };
  [
    ["board", "Browse and search the public board", "UC-013-015, 024, 049"],
    ["auth", "Register, sign in and recover account", "UC-001-003, 006-007"],
    ["profile", "Manage own account, profile and preferences", "UC-004-005, 008-012, 168"],
    ["posts", "Create and manage LOST / FOUND posts", "UC-016, 018-025"],
    ["matches", "Review matching suggestions and feedback", "UC-026-031, 097-100"],
    ["claims", "Submit and review ownership claims", "UC-032-038, 106-111, 115-118"],
    ["chat", "Use private chat and notifications", "UC-039-048, 119-125"],
    ["meetup", "Arrange and manage return appointments", "UC-126-135, 049"],
    ["return", "Complete direct return and give feedback", "UC-058-060, 136-140"],
    ["custody", "Request Staff custody and follow its status", "UC-141-142, 145, 147"],
    ["journey", "View the end-to-end item journey", "UC-167"],
    ["reports", "Submit and follow personal reports", "UC-093-096"],
  ].forEach(([key, name, refs], index) => add(key, name, 0, 180 + index * 186, refs));
  add("ai", "Analyze images for an editable post draft", 1, 738, "UC-017; optional Gemini analysis");
  add("eligibility", "Check claim eligibility and participant consent", 1, 1110, "Supporting behavior; BR-33-36, 69");
  add("evidence", "Upload and view private evidence", 1, 1296, "UC-043-045, 120");
  add("physical", "Check valid physical handover and both confirmations", 1, 1668, "UC-136-139; BR-72");
  [
    ["intake", "Review custody requests and confirm physical intake", 180, "UC-052, 142-146"],
    ["warehouse", "Operate warehouse and return retained items", 405, "UC-050-057"],
    ["escalation", "Review authorized escalated claims and history", 630, "UC-112-114, 164"],
    ["disposition", "Manage retention and controlled disposition", 855, "UC-148-162; Admin approval gates"],
    ["users", "Administer user accounts and roles", 1080, "UC-062-068"],
    ["catalogue", "Manage categories, locations and handover points", 1305, "UC-061, 069-081"],
    ["moderation", "Review reports and apply moderation", 1530, "UC-082-083, 165"],
    ["audit", "View dashboard, statistics and audit exports", 1755, "UC-084-085, 163, 166"],
    ["config", "Manage system configuration", 1980, "UC-086-092"],
    ["models", "Prepare, train and evaluate matching models", 2205, "UC-101-105; Staff: UC-102 only"],
  ].forEach(([key, name, y, refs]) => add(key, name, 2, y, refs));
  const association = (actor, node, label) => d.edges.push({ from: actor, to: node, type: "association", side: ["staff", "admin"].includes(actor) ? "right" : "left", label });
  ["board", "auth"].forEach(node => association("guest", node));
  ["board", "profile", "posts", "matches", "claims", "chat", "meetup", "return", "custody", "journey", "reports"].forEach(node => association("user", node));
  ["intake", "warehouse", "escalation", "disposition"].forEach(node => association("staff", node));
  association("staff", "models");
  ["intake", "warehouse", "escalation", "disposition", "users", "catalogue", "moderation", "audit", "config", "models"].forEach(node => association("admin", node));
  d.edges.push({ from: "ai", to: "posts", type: "extend", condition: "request analysis" });
  d.edges.push({ from: "claims", to: "eligibility", type: "include" });
  d.edges.push({ from: "evidence", to: "chat", type: "extend", condition: "attach or inspect evidence" });
  d.edges.push({ from: "return", to: "physical", type: "include" });
  d.subtitle = "Guest | User (Lost and Finder) | Staff | Admin - complete catalogue scope, including Partial and Planned goals";
  return d;
}

const diagrams = [overview(), ...specifications.map(detailed)];
const allDetailedIds = new Set(diagrams.slice(1).flatMap(d => [...d.ids]));
assert.deepEqual([...allDetailedIds].sort(), [...catalogue.keys()].sort(), "All catalogue UCs must appear in a role diagram");
for (const diagram of diagrams) {
  const keys = new Set([...diagram.nodes.map(node => node.key), ...diagram.actors.map(actor => actor.key)]);
  for (const edge of diagram.edges) {
    assert.ok(keys.has(edge.from) && keys.has(edge.to), `Unresolved edge in ${diagram.key}`);
    assert.notEqual(edge.from, edge.to);
  }
  for (const node of diagram.nodes) {
    assert.ok(node.x >= diagram.boundary.x && node.x + node.w <= diagram.boundary.x + diagram.boundary.w);
    assert.ok(node.y >= diagram.boundary.y + 100 && node.y + node.h < diagram.boundary.y + diagram.boundary.h);
    assert.ok(wrap(node.name).length <= 3, `Label needs more space: ${node.name}`);
  }
}

function edgePoints(d, edge) {
  const nodes = new Map(d.nodes.map(node => [node.key, node]));
  const a = nodes.get(edge.from);
  const b = nodes.get(edge.to);
  if (edge.type === "association") {
    const actor = d.actors.find(item => item.key === edge.from);
    const right = edge.side === "right";
    return [{ x: actor.x + (right ? -8 : 8), y: actor.y + 16 }, { x: right ? b.x + b.w : b.x, y: b.y + b.h / 2 }];
  }
  return a.x < b.x
    ? [{ x: a.x + a.w, y: a.y + a.h / 2 }, { x: b.x, y: b.y + b.h / 2 }]
    : [{ x: a.x, y: a.y + a.h / 2 }, { x: b.x + b.w, y: b.y + b.h / 2 }];
}

function svgText(x, y, text, size = 16, options = "") {
  return `<text x="${x}" y="${y}" font-size="${size}" ${options}>${xml(text)}</text>`;
}
function svgNode(node) {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  const lines = wrap(node.name, node.overview ? 36 : 35);
  const totalLines = lines.length + (node.id ? 2 : 1);
  let y = cy - (totalLines - 1) * 10 + 5;
  let out = `<g data-node="${xml(node.key)}"><ellipse cx="${cx}" cy="${cy}" rx="${node.w / 2}" ry="${node.h / 2}" fill="#fafafa" stroke="#333" stroke-width="1.2"/>`;
  if (node.id) { out += svgText(cx, y, node.id, 13, 'font-weight="bold"'); y += 20; }
  for (const line of lines) { out += svgText(cx, y, line, 16); y += 20; }
  const status = node.id ? `${shortStatus[node.status]}${automaticIds.has(node.id) ? " [auto]" : ""}` : node.reference;
  out += svgText(cx, y, status, node.overview ? 11 : 12, 'fill="#444"');
  return out + "</g>";
}
function svgDiagram(d) {
  const b = d.boundary;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${d.width}" height="${d.height}" viewBox="0 0 ${d.width} ${d.height}" role="img" aria-labelledby="title desc"><title id="title">${xml(d.title)} - LNFS Use Case Diagram</title><desc id="desc">${xml(d.subtitle)}</desc><defs><pattern id="minor" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#ededed" stroke-width="0.7"/></pattern><pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="100" height="100" fill="url(#minor)"/><path d="M 100 0 L 0 0 0 100" fill="none" stroke="#d9d9d9" stroke-width="0.8"/></pattern><marker id="open" markerWidth="11" markerHeight="10" refX="10" refY="5" orient="auto"><path d="M 1 1 L 10 5 L 1 9" fill="none" stroke="#333" stroke-width="1.2"/></marker></defs><rect width="100%" height="100%" fill="#fff"/><rect width="100%" height="100%" fill="url(#grid)"/><g font-family="Arial, sans-serif" text-anchor="middle" fill="#111">`;
  out += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="#333" stroke-width="1.4"/>`;
  out += `<path d="M ${b.x} ${b.y + 54} L ${b.x + b.w} ${b.y + 54}" stroke="#333" stroke-width="1"/>`;
  out += svgText(b.x + b.w / 2, b.y + 24, "System boundary: FPTU Lost & Found System (LNFS)", 17, 'font-weight="bold"');
  out += svgText(b.x + b.w / 2, b.y + 44, d.title, 15);
  out += svgText(b.x + b.w / 2, b.y + 83, d.subtitle, d.key === "00-overview" ? 13 : 12);
  for (const edge of d.edges) {
    const [a, z] = edgePoints(d, edge);
    out += `<path data-edge="${xml(edge.from)}:${xml(edge.to)}" d="M ${a.x} ${a.y} L ${z.x} ${z.y}" stroke="#555" stroke-width="${edge.type === "association" ? 1 : 1.2}" fill="none"${edge.type === "association" ? "" : ' stroke-dasharray="6 4" marker-end="url(#open)"'}/>`;
    if (edge.type !== "association" || edge.label) {
      const lines = edge.label ? [edge.label] : [`<<${edge.type}>>`, ...(edge.condition ? wrap(`[${edge.condition}]`, 22) : [])];
      const x = (a.x + z.x) / 2;
      const y = (a.y + z.y) / 2;
      const width = Math.max(...lines.map(line => line.length)) * 6.8 + 12;
      out += `<rect x="${x - width / 2}" y="${y - 13}" width="${width}" height="${lines.length * 16 + 4}" fill="#fff" fill-opacity="0.96"/>`;
      lines.forEach((line, i) => { out += svgText(x, y + i * 16, line, 12); });
    }
  }
  for (const heading of d.headings) {
    out += `<path d="M ${firstColumn} ${heading.y + 15} L ${b.x + b.w - 35} ${heading.y + 15}" stroke="#aaa" stroke-width="0.7"/>`;
    out += svgText(firstColumn, heading.y, heading.title, 18, 'text-anchor="start" font-weight="bold"');
  }
  for (const node of d.nodes) out += svgNode(node);
  for (const actor of d.actors) {
    const { x, y } = actor;
    out += `<g data-actor="${xml(actor.name)}"><circle cx="${x}" cy="${y - 28}" r="12" fill="#fff" stroke="#333" stroke-width="1.4"/><path d="M ${x} ${y - 16} L ${x} ${y + 24} M ${x - 23} ${y + 1} L ${x + 23} ${y + 1} M ${x} ${y + 24} L ${x - 22} ${y + 55} M ${x} ${y + 24} L ${x + 22} ${y + 55}" fill="none" stroke="#333" stroke-width="1.4"/>${svgText(x, y + 78, actor.name, 18)}</g>`;
  }
  out += svgText(d.width / 2, d.height - 17, "Source: docs/requirements/uc.md | Scope diagram; implementation status is not release acceptance.", 12, 'fill="#555"');
  return out + "</g></svg>";
}

function drawioDiagram(d) {
  const b = d.boundary;
  const cell = (id, value, style, geometry, edge = false, endpoints = "") => `<mxCell id="${xml(id)}" value="${xml(value)}" style="${xml(style)}" ${edge ? 'edge="1"' : 'vertex="1"'} parent="1" ${endpoints}>${geometry}</mxCell>`;
  const geometry = (x, y, w, h) => `<mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/>`;
  const textStyle = "text;html=0;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontFamily=Arial;fontColor=#111111;";
  let cells = '<mxCell id="0"/><mxCell id="1"/>';
  cells += cell("boundary", "", "rounded=0;whiteSpace=wrap;html=0;fillColor=none;strokeColor=#333333;strokeWidth=1.4;", geometry(b.x, b.y, b.w, b.h));
  cells += cell("system-title", `System boundary: FPTU Lost & Found System (LNFS)\n${d.title}`, textStyle + "fontSize=17;fontStyle=1;", geometry(b.x, b.y, b.w, 54));
  cells += cell("system-title-rule", "", "shape=line;strokeColor=#333333;strokeWidth=1;", geometry(b.x, b.y + 54, b.w, 0));
  cells += cell("subtitle", d.subtitle, textStyle + "fontSize=12;", geometry(b.x + 10, b.y + 60, b.w - 20, 35));
  for (const [i, edge] of d.edges.entries()) {
    const [a, z] = edgePoints(d, edge);
    const dependency = edge.type !== "association";
    const label = edge.label ?? (dependency ? `<<${edge.type}>>${edge.condition ? `\n[${edge.condition}]` : ""}` : "");
    const fromNode = d.nodes.find(node => node.key === edge.from);
    const toNode = d.nodes.find(node => node.key === edge.to);
    const exitX = dependency ? (fromNode.x < toNode.x ? 1 : 0) : (edge.side === "right" ? 0 : 1);
    const entryX = dependency ? (fromNode.x < toNode.x ? 0 : 1) : (edge.side === "right" ? 1 : 0);
    const style = `edgeStyle=none;rounded=0;html=0;fontFamily=Arial;fontSize=12;fontColor=#111111;labelBackgroundColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;startArrow=none;endArrow=${dependency ? "open" : "none"};endFill=0;${dependency ? "dashed=1;dashPattern=6 4;" : ""}exitX=${exitX};exitY=0.5;exitPerimeter=0;entryX=${entryX};entryY=0.5;entryPerimeter=0;`;
    const geom = `<mxGeometry relative="1" as="geometry"><mxPoint x="${a.x}" y="${a.y}" as="sourcePoint"/><mxPoint x="${z.x}" y="${z.y}" as="targetPoint"/></mxGeometry>`;
    cells += cell(`edge-${i}`, label, style, geom, true, `source="${xml(edge.from)}" target="${xml(edge.to)}"`);
  }
  for (const [i, heading] of d.headings.entries()) cells += cell(`heading-${i}`, heading.title, textStyle + "fontSize=18;fontStyle=1;align=left;", geometry(firstColumn, heading.y - 22, b.w - 145, 35));
  for (const node of d.nodes) {
    const label = [node.id, ...wrap(node.name, node.overview ? 36 : 35), node.id ? `${shortStatus[node.status]}${automaticIds.has(node.id) ? " [auto]" : ""}` : node.reference].filter(Boolean).join("\n");
    cells += cell(node.key, label, "ellipse;whiteSpace=wrap;html=0;fillColor=#FAFAFA;strokeColor=#333333;strokeWidth=1.2;fontFamily=Arial;fontSize=16;fontColor=#111111;spacing=3;", geometry(node.x, node.y, node.w, node.h));
  }
  for (const actor of d.actors) cells += cell(actor.key, actor.name, "shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=0;fillColor=#FFFFFF;strokeColor=#333333;fontFamily=Arial;fontSize=18;fontColor=#111111;", geometry(actor.x - 22, actor.y - 40, 44, 95));
  cells += cell("footer", "Source: docs/requirements/uc.md | Scope diagram; implementation status is not release acceptance.", textStyle + "fontSize=12;", geometry(100, d.height - 37, d.width - 200, 28));
  return `<diagram id="${d.key}" name="${xml(d.title)}"><mxGraphModel dx="${d.width}" dy="${d.height}" grid="1" gridSize="20" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${d.width}" pageHeight="${d.height}" math="0" shadow="0"><root>${cells}</root></mxGraphModel></diagram>`;
}

await mkdir(join(outputDir, "images"), { recursive: true });
for (const d of diagrams) await writeFile(join(outputDir, "images", `${d.key}.svg`), svgDiagram(d), "utf8");
await writeFile(join(outputDir, "LNFS_USE_CASE_DIAGRAMS.drawio"), `<?xml version="1.0" encoding="utf-8"?>\n<mxfile host="app.diagrams.net" agent="LNFS" version="26.0.16" type="device">${diagrams.map(drawioDiagram).join("\n")}</mxfile>\n`, "utf8");

const symbols = new Map(diagrams.slice(1).map(d => [d.role, d]));
const roleKeys = ["Guest", "Lost", "Finder", "Staff", "Admin"];
const counts = diagrams.slice(1).map(d => `| ${d.role} | ${d.ids.size} | [PNG](images/${d.key}.png) / [SVG](images/${d.key}.svg) |`).join("\n");
const rows = [...catalogue.values()].sort((a, b) => a.id.localeCompare(b.id)).map(uc => `| ${uc.id} | ${uc.name} | ${uc.status} | ${roleKeys.map(role => symbols.get(role).ids.has(uc.id) ? (automaticIds.has(uc.id) ? "Auto" : "X") : "-").join(" | ")} |`).join("\n");
const coverage = `# Đối chiếu 168 UC theo từng sơ đồ vai trò\n\nNguồn: [uc.md](../../requirements/uc.md). File này được tạo từ catalogue và cấu hình trong [generate.mjs](generate.mjs); không thay đổi trạng thái triển khai.\n\n- **X:** actor tham gia trực tiếp, hoặc thông qua một UC include/extend. Các guard về ownership, participant, consent, escalation và dữ liệu tối thiểu vẫn áp dụng.\n- **Auto:** hành vi bên trong hệ thống được trình bày để giải thích luồng của vai trò; không phải nút bấm hoặc quyền kích hoạt thủ công của actor.\n- **-:** không đưa vào sơ đồ vai trò này. Không suy ra quyền của một account có thể mang thêm role khác.\n- Hai sơ đồ Lost/Finder đều sử dụng nhãn actor **User**. Hai vai trò nghiệp vụ này không tạo thêm role DB.\n- Các sơ đồ Staff/Admin tập trung quyền vận hành và tài khoản/public/notification chung. Khi đăng bài hoặc tham gia một case với tư cách người dùng, xem thêm sơ đồ User tương ứng.\n- UC dùng chung được tính trong nhiều sơ đồ; hợp của năm sơ đồ là **168/168 UC**, không cộng các cột để suy ra tổng UC độc lập.\n\n| Vai trò | Số UC duy nhất trong sơ đồ | Ảnh |\n| --- | ---: | --- |\n${counts}\n\n| UC | Tên trong catalogue | Trạng thái | Guest | Lost | Finder | Staff | Admin |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n${rows}\n`;
await writeFile(join(outputDir, "coverage.md"), coverage, "utf8");
await writeFile(join(outputDir, "layout.json"), JSON.stringify(diagrams.map(d => ({ key: d.key, width: d.width, height: d.height, catalogueUCs: d.ids.size, nodes: d.nodes.length, relations: d.edges.length })), null, 2) + "\n", "utf8");

if (process.argv.includes("--render")) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    for (const d of diagrams) {
      const page = await browser.newPage({ viewport: { width: d.width, height: Math.min(d.height, 1100) }, deviceScaleFactor: 1 });
      await page.setContent(`<html><head><style>html,body{margin:0;padding:0}svg{display:block}</style></head><body>${svgDiagram(d)}</body></html>`);
      await page.screenshot({ path: join(outputDir, "images", `${d.key}.png`), fullPage: true, timeout: 60000 });
      await page.close();
      console.log(`Rendered ${d.key}: ${d.width} x ${d.height}`);
    }
  } finally { await browser.close(); }
}
console.log(JSON.stringify({ covered: allDetailedIds.size, total: catalogue.size, diagrams: diagrams.map(d => ({ key: d.key, UCs: d.ids.size, width: d.width, height: d.height })) }, null, 2));
