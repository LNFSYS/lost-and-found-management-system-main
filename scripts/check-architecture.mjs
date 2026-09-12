import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const normalize = (file) => file.replaceAll("\\", "/");
const layer = (file) => file.match(/^(?:modules\/[^/]+|shared)\/(domain|application|infrastructure|interfaces)\//)?.[1];
const moduleName = (file) => file.match(/^modules\/([^/]+)\//)?.[1];

export function auditArchitecture(sources) {
  const errors = [];
  const graph = new Map();
  for (const [file, source] of Object.entries(sources)) {
    if (file.endsWith(".test.ts") || file.startsWith("test/")) continue;
    const edges = new Set();
    graph.set(file, edges);
    const fromLayer = layer(file);
    const fromModule = moduleName(file);
    const core = ["domain", "application"].includes(fromLayer);
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const imports = [];
    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) imports.push(node.argument.literal.text);
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(sf) === "require")) {
        if (node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) imports.push(node.arguments[0].text);
        else if (core) errors.push(`${file}: core cannot load dynamic dependencies`);
      }
      if (core && ts.isIdentifier(node) && node.text === "process") errors.push(`${file}: core cannot access process/environment`);
      if (core && ts.isIdentifier(node) && node.text === "console") errors.push(`${file}: core must use an injected logger port`);
      ts.forEachChild(node, visit);
    }
    visit(sf);
    for (const specifier of imports) {
      if (!specifier.startsWith(".")) {
        if (core) errors.push(`${file}: core external dependency ${specifier}`);
        continue;
      }
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)).replace(/\.js$/, ".ts");
      if (!(target in sources)) { errors.push(`${file}: unresolved source dependency ${specifier}`); continue; }
      edges.add(target);
      const toLayer = layer(target);
      if (fromLayer === "domain" && toLayer !== "domain") errors.push(`${file}: domain -> ${target}`);
      if (fromLayer === "application" && !["domain", "application"].includes(toLayer)) errors.push(`${file}: application -> ${target}`);
      if (fromLayer === "infrastructure" && !["domain", "application", "infrastructure"].includes(toLayer)) errors.push(`${file}: infrastructure -> ${target}`);
      if (fromLayer === "interfaces" && !["domain", "application", "interfaces"].includes(toLayer)) errors.push(`${file}: interfaces -> ${target}`);
      if (file.startsWith("shared/") && target.startsWith("modules/")) errors.push(`${file}: shared cannot depend on business module ${target}`);
      const toModule = moduleName(target);
      if (fromModule && toModule && fromModule !== toModule && target !== `modules/${toModule}/application/index.ts`) errors.push(`${file}: use the public application contract of ${toModule}, not ${target}`);
    }
  }
  // Include type-only dependencies: runtime-only cycle checks can hide core coupling.
  const done = new Set();
  const active = [];
  function visit(file) {
    if (active.includes(file)) { errors.push(`Circular dependency: ${[...active.slice(active.indexOf(file)), file].join(" -> ")}`); return; }
    if (done.has(file)) return;
    active.push(file);
    for (const target of graph.get(file) ?? []) visit(target);
    active.pop();
    done.add(file);
  }
  for (const file of graph.keys()) visit(file);
  return { errors: [...new Set(errors)], files: graph.size };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve("apps/api-node/src");
  const sources = Object.fromEntries(fs.readdirSync(root, { recursive: true }).filter(file => file.endsWith(".ts")).map(file => [normalize(file), fs.readFileSync(path.join(root, file), "utf8")]));
  const result = auditArchitecture(sources);
  for (const error of result.errors) console.error(error);
  console.info(`Architecture: ${result.files} production files, ${result.errors.length} violations (including type dependency cycles).`);
  process.exitCode = result.errors.length ? 1 : 0;
}
