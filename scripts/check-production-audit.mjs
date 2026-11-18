import { spawnSync } from "node:child_process";

const advisoryUrl = "https://github.com/advisories/GHSA-g3hv-75wg-m249";
const expoFingerprintMinimatch = "node_modules/@expo/fingerprint/node_modules/minimatch";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const audit = spawnSync(npmCommand, ["audit", "--omit=dev", "--audit-level=moderate", "--json"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});

if (audit.error) {
  console.error(`Could not run npm audit: ${audit.error.message}`);
  process.exit(1);
}
if (audit.stderr) process.stderr.write(audit.stderr);

let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  console.error("npm audit did not return valid JSON.");
  if (audit.stdout) console.error(audit.stdout);
  process.exit(audit.status || 1);
}

const vulnerabilities = report.vulnerabilities ?? {};
if (audit.status !== 0 && Object.keys(vulnerabilities).length === 0) {
  console.error("npm audit failed without reporting dependency vulnerabilities.");
  process.exit(audit.status || 1);
}

const memo = new Map();
const visiting = new Set();

function isApprovedExpoFinding(name) {
  if (memo.has(name)) return memo.get(name);
  if (visiting.has(name)) return false;

  const finding = vulnerabilities[name];
  if (!finding) return false;
  if (finding.severity === "low") return true;
  if (finding.severity !== "moderate") return false;
  if (name === "minimatch") {
    const nodes = finding.nodes ?? [];
    if (nodes.length === 0 || nodes.some((node) => node !== expoFingerprintMinimatch)) return false;
  }

  visiting.add(name);
  const via = finding.via ?? [];
  const directAdvisories = via.filter((entry) => typeof entry !== "string");
  const dependentPackages = via.filter((entry) => typeof entry === "string");
  const approved = via.length > 0
    && directAdvisories.every((entry) => entry.url === advisoryUrl)
    && dependentPackages.every((dependency) => isApprovedExpoFinding(dependency));
  visiting.delete(name);
  memo.set(name, approved);
  return approved;
}

const blocked = Object.entries(vulnerabilities).filter(([name]) => !isApprovedExpoFinding(name));
if (blocked.length > 0) {
  console.error("npm audit found vulnerabilities outside the documented Expo fingerprint advisory:");
  for (const [name, finding] of blocked) {
    console.error(`- ${name}: ${finding.severity}; via ${JSON.stringify(finding.via ?? [])}`);
  }
  process.exit(1);
}

if (Object.keys(vulnerabilities).length > 0) {
  console.warn(`::warning title=Expo SDK 58 audit exception::Allowing only ${advisoryUrl} at ${expoFingerprintMinimatch}. Expo documents this build-tool finding as not affecting app runtime: https://github.com/expo/expo/issues/52735`);
}
console.log("Production dependency audit passed.");
