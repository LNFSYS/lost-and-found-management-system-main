import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const directory = dirname(fileURLToPath(import.meta.url));
const layout = JSON.parse(await readFile(join(directory, "layout.json"), "utf8"));
const drawio = await readFile(join(directory, "LNFS_USE_CASE_DIAGRAMS.drawio"), "utf8");
const coverage = await readFile(join(directory, "coverage.md"), "utf8");
assert.equal(layout.length, 6);
assert.equal(coverage.split(/\r?\n/).filter(line => /^\| UC-\d{3} \|/.test(line)).length, 168);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 2400, height: 1200 } });
  const drawioResult = await page.evaluate(xml => {
    const document = new DOMParser().parseFromString(xml, "application/xml");
    const errors = [...document.querySelectorAll("parsererror")].map(error => error.textContent);
    const diagrams = [...document.querySelectorAll("diagram")];
    const invalidDirections = diagrams.flatMap(diagram => [...diagram.querySelectorAll('mxCell[edge="1"]')].flatMap(edge => {
      const value = edge.getAttribute("value");
      if (!/^<<(include|extend)>>/.test(value)) return [];
      const source = [...diagram.querySelectorAll("mxCell")].find(cell => cell.id === edge.getAttribute("source"));
      const target = [...diagram.querySelectorAll("mxCell")].find(cell => cell.id === edge.getAttribute("target"));
      const sourceX = Number(source.querySelector("mxGeometry").getAttribute("x"));
      const targetX = Number(target.querySelector("mxGeometry").getAttribute("x"));
      const style = edge.getAttribute("style");
      return (value.startsWith("<<include>>") ? sourceX >= targetX : sourceX <= targetX) || !/endArrow=open;/.test(style) || !/dashed=1;/.test(style) ? [edge.id] : [];
    }));
    return {
      errors,
      pages: diagrams.length,
      invalidDirections,
      duplicateIds: diagrams.flatMap(diagram => {
        const ids = [...diagram.querySelectorAll("mxCell")].map(cell => cell.id);
        return ids.filter((id, index) => ids.indexOf(id) !== index);
      }),
      curved: [...document.querySelectorAll('mxCell[edge="1"]')].filter(cell => /curved=1|orthogonalEdgeStyle/.test(cell.getAttribute("style"))).length,
    };
  }, drawio);
  assert.deepEqual(drawioResult, { errors: [], pages: 6, invalidDirections: [], duplicateIds: [], curved: 0 });
  for (const item of layout) {
    const svg = await readFile(join(directory, "images", `${item.key}.svg`), "utf8");
    const png = await readFile(join(directory, "images", `${item.key}.png`));
    assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), item.width);
    assert.equal(png.readUInt32BE(20), item.height);
    await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
    const result = await page.evaluate(async ({ image, item }) => {
      const labelsOutside = [];
      const overlaps = [];
      const nodes = [...document.querySelectorAll("g[data-node]")];
      const actors = [...document.querySelectorAll("g[data-actor]")].map(node => node.getAttribute("data-actor"));
      const position = node => {
        const ellipse = node.querySelector("ellipse");
        return Object.fromEntries(["cx", "cy", "rx", "ry"].map(key => [key, Number(ellipse.getAttribute(key))]));
      };
      for (const node of nodes) {
        const ellipse = position(node);
        for (const text of node.querySelectorAll("text")) {
          const box = text.getBBox();
          const corners = [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]];
          if (corners.some(([x, y]) => ((x - ellipse.cx) / ellipse.rx) ** 2 + ((y - ellipse.cy) / ellipse.ry) ** 2 > 1.01)) labelsOutside.push(`${node.getAttribute("data-node")}: ${text.textContent}`);
        }
      }
      for (let i = 0; i < nodes.length; i++) {
        const a = position(nodes[i]);
        for (let j = i + 1; j < nodes.length; j++) {
          const b = position(nodes[j]);
          if (Math.abs(a.cx - b.cx) < a.rx + b.rx && Math.abs(a.cy - b.cy) < a.ry + b.ry) overlaps.push([nodes[i].getAttribute("data-node"), nodes[j].getAttribute("data-node")]);
        }
      }
      const lineIntersections = [];
      for (const edge of document.querySelectorAll("path[data-edge]")) {
        const [from, to] = edge.getAttribute("data-edge").split(":");
        const [x1, y1, x2, y2] = edge.getAttribute("d").match(/-?\d+(?:\.\d+)?/g).map(Number);
        for (const node of nodes) {
          const key = node.getAttribute("data-node");
          if (key === from || key === to) continue;
          const e = position(node);
          const ax = (x1 - e.cx) / e.rx;
          const ay = (y1 - e.cy) / e.ry;
          const dx = (x2 - x1) / e.rx;
          const dy = (y2 - y1) / e.ry;
          const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy)));
          if ((ax + t * dx) ** 2 + (ay + t * dy) ** 2 < 0.99) lineIntersections.push(`${from}:${to} crosses ${key}`);
        }
      }
      const bitmap = new Image();
      bitmap.src = `data:image/png;base64,${image}`;
      await bitmap.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = Math.round(item.height / item.width * 320);
      const context = canvas.getContext("2d");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let ink = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] < 210 && data[i + 1] < 210 && data[i + 2] < 210 && data[i + 3] > 0) ink++;
      return { actors, labelsOutside, overlaps, lineIntersections, ink };
    }, { image: png.toString("base64"), item });
    assert.deepEqual(result.labelsOutside, [], `${item.key}: text outside ellipse`);
    assert.deepEqual(result.overlaps, [], `${item.key}: overlapping ellipses`);
    assert.deepEqual(result.lineIntersections, [], `${item.key}: line through unrelated ellipse`);
    assert.ok(result.ink > 500, `${item.key}: blank PNG`);
    assert.deepEqual(result.actors, item.key === "00-overview" ? ["Guest", "User", "Staff", "Admin"] : [item.key === "01-guest" ? "Guest" : item.key === "04-staff" ? "Staff" : item.key === "05-admin" ? "Admin" : "User"]);
    console.log(`${item.key}: ${item.catalogueUCs} UCs; labels, nodes, straight edges and PNG pass`);
  }
} finally { await browser.close(); }
