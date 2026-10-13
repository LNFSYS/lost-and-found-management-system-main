import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const outputDir = 'docs/architecture/system-functional-overview';
const font = 'Arial';
const layout = {
  width: 1840,
  startX: 28,
  loginX: 190,
  dashboardX: 405,
  trunkX: 650,
  moduleX: 705,
  moduleW: 225,
  screenX: 1010,
  screenW: 250,
  actionX: 1390,
  actionW: 390,
  startY: 132,
  firstGroupY: 255,
  actionGap: 58,
  screenGap: 20,
  groupGap: 30,
};

const flows = [
  {
    key: 'finder',
    actor: 'Finder',
    subtitle: '3.1.1 Screens Flow - Finder (User reporting found item)',
    groups: [
      { name: 'Manage FOUND Posts', screens: [
        { name: 'Create FOUND post', actions: ['Enter item details and found location', 'Add photos, analyze, and publish'] },
        { name: 'My FOUND posts', actions: ['Edit or close a FOUND post', 'View matching results and item journey'] },
      ] },
      { name: 'Review LOST Matches', screens: [
        { name: 'Matching results', actions: ['Review LOST candidates and match scores', 'Open a LOST post for comparison'] },
        { name: 'LOST post details', actions: ['Start a claim with the item owner', 'Return to matching results'] },
      ] },
      { name: 'Verify Item with Owner', screens: [
        { name: 'Private conversation', actions: ['Exchange messages and chat photos', 'Answer verification questions and share evidence'] },
        { name: 'Finder decision', actions: ['Propose a meeting or request more information', 'Reject the claim or transfer item to custody'] },
      ] },
      { name: 'Arrange Handover', screens: [
        { name: 'Appointments', actions: ['Propose, view, or reschedule a meeting', 'Confirm item handover or report no-show'] },
        { name: 'Notifications and journey', actions: ['Open matching and appointment notices', 'Review item journey through return or custody'] },
      ] },
    ],
  },
  {
    key: 'owner-lost',
    actor: 'Owner',
    subtitle: '3.1.1 Screens Flow - Lost Item Owner (User reporting lost item)',
    groups: [
      { name: 'Manage LOST Posts', screens: [
        { name: 'Create LOST post', actions: ['Enter item details, time, and lost location', 'Add photos, analyze, and publish'] },
        { name: 'My LOST posts', actions: ['Edit or close a LOST post', 'View matching results and item journey'] },
      ] },
      { name: 'Find the Item', screens: [
        { name: 'Matching results', actions: ['Review FOUND candidates and match scores', 'Open a FOUND post for comparison'] },
        { name: 'FOUND post details', actions: ['Send a claim to the Finder', 'Open an existing claim conversation'] },
      ] },
      { name: 'Verify Ownership', screens: [
        { name: 'Private conversation', actions: ['Answer Finder verification questions', 'Send messages, photos, and private evidence'] },
        { name: 'Claim and decision status', actions: ['Review claim status and Finder decision', 'Continue discussion or provide requested information'] },
      ] },
      { name: 'Receive the Item', screens: [
        { name: 'Appointments', actions: ['Propose, accept, or reschedule a meeting', 'View meeting place and appointment status'] },
        { name: 'Handover and item journey', actions: ['Confirm item received after handover', 'Review item journey including custody and return'] },
      ] },
    ],
  },
  {
    key: 'staff',
    actor: 'Staff',
    subtitle: '3.1.1 Screens Flow - Staff',
    groups: [
      { name: 'Process Custody Requests', screens: [
        { name: 'Custody request queue', actions: ['Filter and review custody requests', 'Accept or reject a custody request'] },
        { name: 'Warehouse intake', actions: ['Receive transferred or walk-in item', 'Record intake details and item photos'] },
      ] },
      { name: 'Manage Warehouse', screens: [
        { name: 'Warehouse inventory', actions: ['Search and filter stored items', 'Open item details and storage history'] },
        { name: 'Warehouse item details', actions: ['Update item storage status and location', 'Review custody and related claim information'] },
      ] },
      { name: 'Return Item to Owner', screens: [
        { name: 'Claim verification at desk', actions: ['Review claim and recipient information', 'Verify recipient before releasing the item'] },
        { name: 'Warehouse return', actions: ['Record return proof photo and handover', 'Update inventory and return status'] },
      ] },
      { name: 'Review Staff Workspace', screens: [
        { name: 'Warehouse overview tab', actions: ['Open the warehouse overview tab', 'Return to custody or inventory tabs'] },
        { name: 'System history tab', actions: ['Open the system history tab', 'Return to the staff workspace'] },
      ] },
    ],
  },
  {
    key: 'admin',
    actor: 'Admin',
    subtitle: '3.1.1 Screens Flow - Admin',
    groups: [
      { name: 'View System Operations', screens: [
        { name: 'Administration dashboard', actions: ['View KPIs, trends, and status breakdown', 'Export system statistics'] },
      ] },
      { name: 'Moderate System Content', screens: [
        { name: 'Moderation reports', actions: ['Search and review reports', 'Resolve reports and apply moderation actions'] },
      ] },
      { name: 'Manage Users and Settings', screens: [
        { name: 'User management', actions: ['Search and review user accounts', 'Create users and update roles or status'] },
        { name: 'System configuration', actions: ['Manage system configuration', 'Manage categories, locations, and handover points'] },
      ] },
      { name: 'Review Audit Records', screens: [
        { name: 'Administrative audit logs', actions: ['Search system audit events', 'Export audit and moderation data'] },
      ] },
      { name: 'Operate Custody and Warehouse', screens: [
        { name: 'Staff operations workspace', actions: ['Open custody request queue', 'Open warehouse inventory and item details'] },
      ] },
    ],
  },
];

const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function wrap(label, width, fontSize) {
  const maxChars = Math.max(10, Math.floor(width / (fontSize * 0.58)));
  const lines = [];
  let line = '';
  for (const word of label.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

function svgText(label, x, y, width, height, fontSize = 14, weight = 'normal') {
  const lines = wrap(label, width - 16, fontSize);
  const lineHeight = fontSize * 1.2;
  const firstY = y + height / 2 - ((lines.length - 1) * lineHeight) / 2 + fontSize * 0.34;
  return `<text x="${x + width / 2}" y="${firstY}" text-anchor="middle" font-family="${font}" font-size="${fontSize}" font-weight="${weight}" fill="#000000">${lines.map((line, index) => `<tspan x="${x + width / 2}" y="${firstY + index * lineHeight}">${esc(line)}</tspan>`).join('')}</text>`;
}

function makeDiagram(flow) {
  const nodes = [];
  const edges = [];
  let id = 2;
  const node = (label, type, x, y, w, h, visible = true) => {
    const result = { id: String(id++), label, type, x, y, w, h, visible };
    nodes.push(result);
    return result;
  };
  const edge = (source, target, points, arrow = true) => edges.push({ id: String(id++), source, target, points, arrow });

  const start = node(flow.actor, 'diamond', layout.startX, layout.startY, 100, 72);
  const login = node('Login', 'rect', layout.loginX, layout.startY + 11, 150, 50);
  const dashboard = node('Dashboard', 'rect', layout.dashboardX, layout.startY + 11, 160, 50);
  edge(start, login, [[layout.startX + 100, layout.startY + 36], [layout.loginX, layout.startY + 36]]);
  edge(login, dashboard, [[layout.loginX + 150, layout.startY + 36], [layout.dashboardX, layout.startY + 36]]);

  let cursorY = layout.firstGroupY;
  const groups = [];
  for (const group of flow.groups) {
    const screens = [];
    const groupStart = cursorY;
    for (const screen of group.screens) {
      const actionCenters = screen.actions.map((_, index) => cursorY + 25 + index * layout.actionGap);
      screens.push({ screen, actionCenters, centerY: (actionCenters[0] + actionCenters.at(-1)) / 2 });
      cursorY += screen.actions.length * layout.actionGap + layout.screenGap;
    }
    cursorY -= layout.screenGap;
    const centerY = (groupStart + cursorY) / 2;
    groups.push({ group, screens, centerY });
    cursorY += layout.groupGap;
  }

  const mainTrunkX = layout.trunkX;
  const dashboardCenterY = layout.startY + 36;
  const topAnchor = node('', 'anchor', mainTrunkX, dashboardCenterY, 1, 1, false);
  const bottomAnchor = node('', 'anchor', mainTrunkX, groups.at(-1).centerY, 1, 1, false);
  edge(dashboard, topAnchor, [[layout.dashboardX + 160, dashboardCenterY], [mainTrunkX, dashboardCenterY]], false);
  edge(topAnchor, bottomAnchor, [[mainTrunkX, dashboardCenterY], [mainTrunkX, groups.at(-1).centerY]], false);

  for (const group of groups) {
    const module = node(group.group.name, 'rect', layout.moduleX, group.centerY - 28, layout.moduleW, 56);
    const moduleAnchor = node('', 'anchor', mainTrunkX, group.centerY, 1, 1, false);
    edge(moduleAnchor, module, [[mainTrunkX, group.centerY], [layout.moduleX, group.centerY]]);

    const screenX = layout.screenX - 42;
    const screenYs = group.screens.map(item => item.centerY);
    const screenAnchorFirst = node('', 'anchor', screenX, screenYs[0], 1, 1, false);
    const screenAnchorLast = screenYs.length > 1 ? node('', 'anchor', screenX, screenYs.at(-1), 1, 1, false) : screenAnchorFirst;
    const moduleJoin = node('', 'anchor', layout.moduleX + layout.moduleW + 42, group.centerY, 1, 1, false);
    edge(module, moduleJoin, [[layout.moduleX + layout.moduleW, group.centerY], [layout.moduleX + layout.moduleW + 42, group.centerY]], false);
    if (screenYs.length > 1) edge(screenAnchorFirst, screenAnchorLast, [[screenX, screenYs[0]], [screenX, screenYs.at(-1)]], false);
    edge(moduleJoin, screenAnchorFirst, [[layout.moduleX + layout.moduleW + 42, group.centerY], [screenX, group.centerY], [screenX, screenYs[0]]], false);

    for (const item of group.screens) {
      const screen = node(item.screen.name, 'rect', layout.screenX, item.centerY - 26, layout.screenW, 52);
      const screenAnchor = node('', 'anchor', screenX, item.centerY, 1, 1, false);
      edge(screenAnchor, screen, [[screenX, item.centerY], [layout.screenX, item.centerY]]);

      const actionX = layout.actionX - 44;
      const firstAction = node('', 'anchor', actionX, item.actionCenters[0], 1, 1, false);
      const lastAction = item.actionCenters.length > 1 ? node('', 'anchor', actionX, item.actionCenters.at(-1), 1, 1, false) : firstAction;
      const actionJoin = node('', 'anchor', layout.screenX + layout.screenW + 44, item.centerY, 1, 1, false);
      edge(screen, actionJoin, [[layout.screenX + layout.screenW, item.centerY], [layout.screenX + layout.screenW + 44, item.centerY]], false);
      if (item.actionCenters.length > 1) edge(firstAction, lastAction, [[actionX, item.actionCenters[0]], [actionX, item.actionCenters.at(-1)]], false);
      edge(actionJoin, firstAction, [[layout.screenX + layout.screenW + 44, item.centerY], [actionX, item.centerY], [actionX, item.actionCenters[0]]], false);

      item.screen.actions.forEach((action, index) => {
        const centerY = item.actionCenters[index];
        const actionNode = node(action, 'oval', layout.actionX, centerY - 24, layout.actionW, 48);
        const anchor = index === 0 ? firstAction : index === item.actionCenters.length - 1 ? lastAction : node('', 'anchor', actionX, centerY, 1, 1, false);
        edge(anchor, actionNode, [[actionX, centerY], [layout.actionX, centerY]]);
      });
    }
  }

  const height = Math.ceil(cursorY + 35);
  const styles = {
    diamond: 'rhombus;whiteSpace=wrap;html=1;strokeColor=#000000;fillColor=#FFB74D;strokeWidth=1;align=center;verticalAlign=middle;fontFamily=Arial;fontSize=14;fontColor=#000000;',
    rect: 'rounded=0;whiteSpace=wrap;html=1;strokeColor=#000000;fillColor=#FFFFFF;strokeWidth=1;align=center;verticalAlign=middle;fontFamily=Arial;fontSize=14;fontColor=#000000;',
    oval: 'ellipse;whiteSpace=wrap;html=1;strokeColor=#000000;fillColor=#FFFFFF;strokeWidth=1;align=center;verticalAlign=middle;fontFamily=Arial;fontSize=13;fontColor=#000000;',
    anchor: 'ellipse;opacity=0;strokeColor=none;fillColor=none;connectable=0;',
  };
  const mxCells = [
    '<mxCell id="0"/>',
    '<mxCell id="1" parent="0"/>',
    ...nodes.map(item => `<mxCell id="${item.id}" value="${esc(item.label)}" style="${styles[item.type]}" vertex="1" parent="1"><mxGeometry x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" as="geometry"/></mxCell>`),
    ...edges.map(item => `<mxCell id="${item.id}" style="edgeStyle=none;rounded=0;html=1;strokeColor=#000000;strokeWidth=1;endArrow=${item.arrow ? 'block' : 'none'};endFill=1;" edge="1" parent="1" source="${item.source.id}" target="${item.target.id}"><mxGeometry relative="1" as="geometry"><Array as="points">${item.points.map(([x, y]) => `<mxPoint x="${x}" y="${y}"/>`).join('')}</Array></mxGeometry></mxCell>`),
  ];
  const model = `<mxGraphModel dx="${layout.width}" dy="${height}" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${layout.width}" pageHeight="${height}" math="0" shadow="0"><root>${mxCells.join('')}</root></mxGraphModel>`;
  const pageXml = `<diagram id="${flow.key}-screen-flow" name="${esc(flow.actor)} Screens Flow">${model}</diagram>`;
  const drawio = `<?xml version="1.0" encoding="UTF-8"?><mxfile host="app.diagrams.net" agent="Codex" version="24.7.17">${pageXml}</mxfile>`;

  const svgEdges = edges.map(item => `<polyline points="${item.points.map(([x, y]) => `${x},${y}`).join(' ')}" fill="none" stroke="#000000" stroke-width="1"${item.arrow ? ' marker-end="url(#arrow)"' : ''}/>`).join('');
  const svgNodes = nodes.filter(item => item.visible).map(item => {
    const shape = item.type === 'diamond'
      ? `<polygon points="${item.x + item.w / 2},${item.y} ${item.x + item.w},${item.y + item.h / 2} ${item.x + item.w / 2},${item.y + item.h} ${item.x},${item.y + item.h / 2}" fill="#FFB74D" stroke="#000000" stroke-width="1"/>`
      : item.type === 'oval'
        ? `<ellipse cx="${item.x + item.w / 2}" cy="${item.y + item.h / 2}" rx="${item.w / 2}" ry="${item.h / 2}" fill="#FFFFFF" stroke="#000000" stroke-width="1"/>`
        : `<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" fill="#FFFFFF" stroke="#000000" stroke-width="1"/>`;
    return shape + svgText(item.label, item.x, item.y, item.w, item.h, item.type === 'oval' ? 13 : 14);
  }).join('');
  const svgContent = `<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,4 L0,8 z" fill="#000000"/></marker></defs><rect width="100%" height="100%" fill="#FFFFFF"/><text x="${layout.width / 2}" y="42" text-anchor="middle" font-family="Arial" font-size="22" font-weight="bold" fill="#000000">System Functional Overview</text><text x="${layout.width / 2}" y="72" text-anchor="middle" font-family="Arial" font-size="15" fill="#000000">${esc(flow.subtitle)}</text>${svgEdges}${svgNodes}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${height}" viewBox="0 0 ${layout.width} ${height}">${svgContent}</svg>`;
  return { drawio, pageXml, svg, svgContent, height, visibleNodes: nodes.filter(item => item.visible).length, connectors: edges.length };
}

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const generated = [];
try {
  for (const flow of flows) {
    const base = `${outputDir}/${flow.key}-screen-flow`;
    const diagram = makeDiagram(flow);
    await writeFile(`${base}.drawio`, diagram.drawio, 'utf8');
    await writeFile(`${base}.svg`, diagram.svg, 'utf8');
    const page = await browser.newPage({ viewport: { width: layout.width, height: diagram.height }, deviceScaleFactor: 1 });
    await page.setContent(`<html><body style="margin:0;width:${layout.width}px;height:${diagram.height}px">${diagram.svg}</body></html>`, { waitUntil: 'load' });
    await page.screenshot({ path: `${base}.png`, fullPage: true });
    await page.close();
    generated.push({ flow, diagram });
    console.log(`${flow.actor}: ${diagram.visibleNodes} visible nodes, ${diagram.connectors} connectors, ${layout.width}x${diagram.height}`);
  }

  const masterDrawio = `<?xml version="1.0" encoding="UTF-8"?><mxfile host="app.diagrams.net" agent="Codex" version="24.7.17">${generated.map(({ diagram }) => diagram.pageXml).join('')}</mxfile>`;
  const pageGap = 42;
  const masterHeight = generated.reduce((sum, item) => sum + item.diagram.height, 0) + pageGap * (generated.length - 1);
  let offsetY = 0;
  const pagesSvg = generated.map(({ diagram }) => {
    const page = `<svg x="0" y="${offsetY}" width="${layout.width}" height="${diagram.height}" viewBox="0 0 ${layout.width} ${diagram.height}">${diagram.svgContent}</svg>`;
    offsetY += diagram.height + pageGap;
    return page;
  }).join('');
  const masterSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${masterHeight}" viewBox="0 0 ${layout.width} ${masterHeight}"><rect width="100%" height="100%" fill="#FFFFFF"/>${pagesSvg}</svg>`;
  await writeFile('docs/architecture/LNFS_SYSTEM_FUNCTIONAL_OVERVIEW_3.1.1.drawio', masterDrawio, 'utf8');
  await writeFile('docs/architecture/LNFS_SYSTEM_FUNCTIONAL_OVERVIEW_3.1.1.svg', masterSvg, 'utf8');
  const overviewPage = await browser.newPage({ viewport: { width: layout.width, height: masterHeight }, deviceScaleFactor: 1 });
  await overviewPage.setContent(`<html><body style="margin:0;width:${layout.width}px;height:${masterHeight}px">${masterSvg}</body></html>`, { waitUntil: 'load' });
  await overviewPage.screenshot({ path: 'docs/architecture/LNFS_SYSTEM_FUNCTIONAL_OVERVIEW_3.1.1.png', fullPage: true });
  await overviewPage.close();
} finally {
  await browser.close();
}
