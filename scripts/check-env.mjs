import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const envPath = path.join(root, ".env");
if (!fs.existsSync(envPath)) {
  console.error("Missing .env. Copy .env.example to .env and fill in the shared MySQL values.");
  process.exit(1);
}

const required = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD", "JWT_ACCESS_SECRET", "SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"];
const values = Object.fromEntries(fs.readFileSync(envPath, "utf8").split(/\r?\n/).filter((line) => line.includes("=") && !line.trimStart().startsWith("#")).map((line) => {
  const index = line.indexOf("=");
  return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
}));
const missing = required.filter((key) => !values[key] || values[key].includes("change_me") || values[key].includes("replace_with") || values[key].includes("your-"));
if (values.DB_SSL?.toLowerCase() === "true" && values.DB_SSL_CA_PATH) {
  const caPath = path.resolve(root, values.DB_SSL_CA_PATH);
  if (!fs.existsSync(caPath)) missing.push("DB_SSL_CA_PATH file");
}
if (missing.length) {
  console.error(`Missing or placeholder environment values: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("Environment file contains the required non-placeholder keys. Secrets were not printed.");
