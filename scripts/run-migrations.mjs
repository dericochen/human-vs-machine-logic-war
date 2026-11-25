// Runs the Supabase migrations (0001 schema + 0002 seed) against the project
// via the Management API query endpoint.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) {
  console.error("Set SUPABASE_ACCESS_TOKEN (your Supabase personal access token, sbp_...).");
  process.exit(1);
}
const REF = process.env.SUPABASE_PROJECT_REF ?? "wrmazuxnzakutzvvwhib";
const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Split SQL into statements, respecting $$ dollar-quoted bodies and comments.
function splitSql(sql) {
  const statements = [];
  let current = "";
  let inDollar = false;
  let i = 0;
  while (i < sql.length) {
    if (sql.startsWith("$$", i)) {
      current += "$$";
      inDollar = !inDollar;
      i += 2;
      continue;
    }
    if (!inDollar && sql.startsWith("--", i)) {
      while (i < sql.length && sql[i] !== "\n") i++;
      continue;
    }
    if (!inDollar && sql.startsWith("/*", i)) {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }
    if (sql[i] === ";" && !inDollar) {
      const s = current.trim();
      if (s) statements.push(s);
      current = "";
      i++;
      continue;
    }
    current += sql[i];
    i++;
  }
  const last = current.trim();
  if (last) statements.push(last);
  return statements;
}

async function run(sql) {
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

const files = ["supabase/migrations/0001_init.sql", "supabase/migrations/0002_seed_bank.sql"];
let failures = 0;
let total = 0;

for (const f of files) {
  const sql = readFileSync(join(root, f), "utf8");
  const statements = splitSql(sql);
  console.log(`\n=== ${f} (${statements.length} statements) ===`);
  for (let i = 0; i < statements.length; i++) {
    const s = statements[i];
    const { status, body } = await run(s);
    total++;
    const ok = status >= 200 && status < 300;
    if (!ok) failures++;
    const preview = s.replace(/\s+/g, " ").slice(0, 70);
    console.log(`[${String(i + 1).padStart(3)}] ${status} ${preview}${preview.length >= 70 ? "…" : ""}`);
    if (!ok) console.log("      -> " + body.slice(0, 260));
  }
}

console.log(`\n${failures === 0 ? "MIGRATIONS COMPLETE" : failures + " FAILURES"} (${total} statements)`);
process.exit(failures === 0 ? 0 : 1);
